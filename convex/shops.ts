import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  requireActiveSeller,
  requireRole,
  getSellerSubscription,
} from "./lib/rbac";

const shopInput = {
  name: v.string(),
  description: v.optional(v.string()),
  logo: v.optional(v.string()),
  banner: v.optional(v.string()),
  location: v.string(),
  phone: v.string(),
  whatsapp: v.optional(v.string()),
  openHour: v.optional(v.string()),
  closeHour: v.optional(v.string()),
  fulfilment: v.array(v.string()),
  categories: v.array(v.string()),
};

/** The signed-in seller's own shop (or null). */
export const myShop = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query("shops")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .unique();
  },
});

/** Public shop page data: shop + its published, available food. */
export const getPublic = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, { shopId }) => {
    const shop = await ctx.db.get(shopId);
    if (!shop || !shop.active) return null;
    const foods = await ctx.db
      .query("foodItems")
      .withIndex("by_shop", (q) => q.eq("shopId", shopId))
      .collect();
    return {
      shop,
      foods: foods.filter((f) => f.status === "published"),
    };
  },
});

/** Marketplace listing — active shops, premium/featured first. */
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const shops = await ctx.db
      .query("shops")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return shops.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.ratingAvg - a.ratingAvg;
    });
  },
});

export const create = mutation({
  args: shopInput,
  handler: async (ctx, args) => {
    const profile = await requireActiveSeller(ctx);
    const existing = await ctx.db
      .query("shops")
      .withIndex("by_owner", (q) => q.eq("ownerId", profile.userId))
      .unique();
    if (existing) throw new Error("You already have a shop");

    // Premium subscribers get featured placement.
    const sub = await getSellerSubscription(ctx, profile.userId);
    const plan = sub
      ? await ctx.db
          .query("subscriptionPlans")
          .withIndex("by_key", (q) => q.eq("key", sub.planKey))
          .unique()
      : null;

    return ctx.db.insert("shops", {
      ownerId: profile.userId,
      ...args,
      active: true,
      featured: plan?.premium ?? false,
      ratingAvg: 0,
      ratingCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: { shopId: v.id("shops"), ...shopInput },
  handler: async (ctx, { shopId, ...patch }) => {
    const profile = await requireRole(ctx, "seller", "admin");
    const shop = await ctx.db.get(shopId);
    if (!shop) throw new Error("Shop not found");
    if (shop.ownerId !== profile.userId && profile.role !== "admin") {
      throw new Error("You can only edit your own shop");
    }
    await ctx.db.patch(shopId, patch);
  },
});

/** Open/close the shop. Allowed even when the subscription has lapsed. */
export const setActive = mutation({
  args: { shopId: v.id("shops"), active: v.boolean() },
  handler: async (ctx, { shopId, active }) => {
    const profile = await requireRole(ctx, "seller", "admin");
    const shop = await ctx.db.get(shopId);
    if (!shop) throw new Error("Shop not found");
    if (shop.ownerId !== profile.userId && profile.role !== "admin") {
      throw new Error("You can only manage your own shop");
    }
    await ctx.db.patch(shopId, { active });
  },
});
