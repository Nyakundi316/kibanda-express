import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth } from "./lib/rbac";

// The cart is per-user. Signed-out callers get an empty cart and can't mutate
// it — checkout needs an identity to route orders to sellers anyway.
async function myLines(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId)
    return { userId: null as Id<"users"> | null, lines: [] as Doc<"cartLines">[] };
  const lines = await ctx.db
    .query("cartLines")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return { userId, lines };
}

export const list = query({
  args: {},
  handler: async (ctx) => (await myLines(ctx)).lines,
});

// Total items across the signed-in user's lines — drives the nav badge.
export const count = query({
  args: {},
  handler: async (ctx) => {
    const { lines } = await myLines(ctx);
    return lines.reduce((n, l) => n + l.qty, 0);
  },
});

/**
 * Add a real marketplace food item. Price/name/image/seller come from the DB,
 * never the client, so totals can't be tampered with.
 */
export const addFood = mutation({
  args: { foodId: v.id("foodItems"), qty: v.optional(v.number()) },
  handler: async (ctx, { foodId, qty }) => {
    const userId = await requireAuth(ctx);
    const food = await ctx.db.get(foodId);
    if (!food || food.status !== "published")
      throw new Error("This item is not available");
    if (food.availability !== "available")
      throw new Error(`"${food.name}" is ${food.availability.replace("_", " ")}`);
    const shop = await ctx.db.get(food.shopId);
    if (!shop || !shop.active) throw new Error("This shop is closed");

    const amount = qty && qty > 0 ? qty : 1;
    const existing = (
      await ctx.db
        .query("cartLines")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).find((l) => l.foodId === foodId);

    if (existing) {
      await ctx.db.patch(existing._id, { qty: existing.qty + amount });
      return existing._id;
    }
    return ctx.db.insert("cartLines", {
      userId,
      foodId,
      shopId: food.shopId,
      sellerId: food.sellerId,
      name: food.name,
      vendor: shop.name,
      price: food.price,
      image: food.image ?? "",
      qty: amount,
    });
  },
});

/**
 * Legacy add (home demo sections). Still works, now requires sign-in and is
 * scoped to the user. These lines carry no seller, so they form an unrouted
 * order at checkout.
 */
export const add = mutation({
  args: {
    name: v.string(),
    vendor: v.string(),
    price: v.number(),
    image: v.string(),
    qty: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { name, vendor, price, image, qty, note }) => {
    const userId = await requireAuth(ctx);
    const amount = qty && qty > 0 ? qty : 1;

    const existing = (
      await ctx.db
        .query("cartLines")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).find((l) => l.name === name && l.vendor === vendor && !l.foodId);

    if (existing) {
      await ctx.db.patch(existing._id, { qty: existing.qty + amount });
      return existing._id;
    }
    return ctx.db.insert("cartLines", {
      userId,
      name,
      vendor,
      price,
      image,
      qty: amount,
      ...(note ? { note } : {}),
    });
  },
});

async function ownLine(ctx: MutationCtx, id: Id<"cartLines">) {
  const userId = await requireAuth(ctx);
  const line = await ctx.db.get(id);
  if (!line || line.userId !== userId) return null;
  return line;
}

export const setQty = mutation({
  args: { id: v.id("cartLines"), delta: v.number() },
  handler: async (ctx, { id, delta }) => {
    const line = await ownLine(ctx, id);
    if (!line) return;
    const qty = line.qty + delta;
    if (qty <= 0) await ctx.db.delete(id);
    else await ctx.db.patch(id, { qty });
  },
});

export const remove = mutation({
  args: { id: v.id("cartLines") },
  handler: async (ctx, { id }) => {
    const line = await ownLine(ctx, id);
    if (line) await ctx.db.delete(id);
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const { lines } = await myLines(ctx);
    await Promise.all(lines.map((l) => ctx.db.delete(l._id)));
  },
});

/**
 * Re-add a past order's items to the cart. Prices come from the current food
 * docs (not the old order), and anything unpublished, sold out, or from a
 * closed shop is skipped rather than failing the whole reorder.
 */
export const reorder = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: async (ctx, { orderId }) => {
    const userId = await requireAuth(ctx);
    const order = await ctx.db.get(orderId);
    if (!order || order.customerId !== userId) throw new Error("Order not found");

    const items = await ctx.db
      .query("marketplaceOrderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    const lines = await ctx.db
      .query("cartLines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let added = 0;
    const skipped: string[] = [];
    for (const it of items) {
      if (!it.foodId) {
        skipped.push(it.name);
        continue;
      }
      const food = await ctx.db.get(it.foodId);
      if (!food || food.status !== "published" || food.availability !== "available") {
        skipped.push(it.name);
        continue;
      }
      const shop = await ctx.db.get(food.shopId);
      if (!shop || !shop.active) {
        skipped.push(it.name);
        continue;
      }

      const existing = lines.find((l) => l.foodId === it.foodId);
      if (existing) {
        await ctx.db.patch(existing._id, { qty: existing.qty + it.qty });
      } else {
        await ctx.db.insert("cartLines", {
          userId,
          foodId: it.foodId,
          shopId: food.shopId,
          sellerId: food.sellerId,
          name: food.name,
          vendor: shop.name,
          price: food.price,
          image: food.image ?? "",
          qty: it.qty,
        });
      }
      added++;
    }

    if (added === 0)
      throw new Error("None of the items from this order are available right now");
    return { added, skipped };
  },
});
