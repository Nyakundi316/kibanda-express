import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  availabilityValidator,
  foodStatusValidator,
} from "./schema";
import {
  requireActiveSeller,
  requireRole,
  getSellerSubscription,
} from "./lib/rbac";

// Lightweight keyword → category / tag inference for the draft generator.
const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/chai|coffee|juice|soda|water|milkshake|smoothie|drink|mala|dawa|cocoa/i, "Drinks"],
  [/mandazi|samosa|bhajia|crisp|fries|smokie|sausage|cake|snack|maize/i, "Snacks"],
  [/uji|egg|bread|porridge|pancake|breakfast|mahamri/i, "Breakfast"],
  [/nyama|ugali|mukimo|githeri|matoke|sukuma|pilau|fish|chicken|choma/i, "Local Meals"],
];

function inferDraft(name: string) {
  const trimmed = name.trim();
  const category =
    CATEGORY_HINTS.find(([re]) => re.test(trimmed))?.[1] ?? "Lunch";
  const tags = Array.from(
    new Set(
      trimmed
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 2)
    )
  ).slice(0, 5);
  const description = `Freshly prepared ${trimmed.toLowerCase()}, made to order. Edit this description before publishing.`;
  return { category, tags, description };
}

/** Current seller's full menu (all statuses). */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("foodItems")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .collect();
  },
});

/**
 * "Type a name, snap a photo" → instant draft. The app fills in category, tags
 * and a starter description; the seller reviews price/quantity and publishes.
 */
export const createDraft = mutation({
  args: { name: v.string(), image: v.optional(v.string()) },
  handler: async (ctx, { name, image }) => {
    const profile = await requireActiveSeller(ctx);
    if (!name.trim()) throw new Error("Food name is required");

    const shop = await ctx.db
      .query("shops")
      .withIndex("by_owner", (q) => q.eq("ownerId", profile.userId))
      .unique();
    if (!shop) throw new Error("Create your shop first");

    // Enforce the plan's listing cap (archived items don't count).
    const sub = await getSellerSubscription(ctx, profile.userId);
    const plan = sub
      ? await ctx.db
          .query("subscriptionPlans")
          .withIndex("by_key", (q) => q.eq("key", sub.planKey))
          .unique()
      : null;
    const cap = plan?.maxListings ?? 20;
    const current = (
      await ctx.db
        .query("foodItems")
        .withIndex("by_seller", (q) => q.eq("sellerId", profile.userId))
        .collect()
    ).filter((f) => f.status !== "archived").length;
    if (current >= cap) {
      throw new Error(`Your plan allows up to ${cap} active listings`);
    }

    const draft = inferDraft(name);
    return ctx.db.insert("foodItems", {
      shopId: shop._id,
      sellerId: profile.userId,
      name: name.trim(),
      category: draft.category,
      description: draft.description,
      tags: draft.tags,
      price: 0,
      quantity: 1,
      image,
      availability: "available",
      status: "draft",
      boosted: false,
      soldCount: 0,
      createdAt: Date.now(),
    });
  },
});

async function ownFood(ctx: any, foodId: any) {
  const profile = await requireActiveSeller(ctx);
  const food = await ctx.db.get(foodId);
  if (!food) throw new Error("Food item not found");
  if (food.sellerId !== profile.userId && profile.role !== "admin") {
    throw new Error("You can only edit your own food items");
  }
  return { profile, food };
}

export const update = mutation({
  args: {
    foodId: v.id("foodItems"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    price: v.optional(v.number()),
    quantity: v.optional(v.number()),
    prepTimeMins: v.optional(v.number()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, { foodId, ...patch }) => {
    await ownFood(ctx, foodId);
    if (patch.price !== undefined && patch.price < 0)
      throw new Error("Price cannot be negative");
    if (patch.quantity !== undefined && patch.quantity < 0)
      throw new Error("Quantity cannot be negative");
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(foodId, clean);
  },
});

export const publish = mutation({
  args: { foodId: v.id("foodItems") },
  handler: async (ctx, { foodId }) => {
    const { food } = await ownFood(ctx, foodId);
    if (food.price <= 0) throw new Error("Set a price above 0 before publishing");
    await ctx.db.patch(foodId, { status: "published" });
  },
});

export const setAvailability = mutation({
  args: { foodId: v.id("foodItems"), availability: availabilityValidator },
  handler: async (ctx, { foodId, availability }) => {
    await ownFood(ctx, foodId);
    await ctx.db.patch(foodId, { availability });
  },
});

export const setStatus = mutation({
  args: { foodId: v.id("foodItems"), status: foodStatusValidator },
  handler: async (ctx, { foodId, status }) => {
    await ownFood(ctx, foodId);
    await ctx.db.patch(foodId, { status });
  },
});

export const remove = mutation({
  args: { foodId: v.id("foodItems") },
  handler: async (ctx, { foodId }) => {
    await ownFood(ctx, foodId);
    await ctx.db.delete(foodId);
  },
});
