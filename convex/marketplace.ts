import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Only show food that's published, in-stock-ish, and from an open shop.
async function activeShopIds(ctx: QueryCtx) {
  const shops = await ctx.db
    .query("shops")
    .withIndex("by_active", (q) => q.eq("active", true))
    .collect();
  const map = new Map<Id<"shops">, Doc<"shops">>();
  for (const s of shops) map.set(s._id, s);
  return map;
}

/**
 * Browse the marketplace. Filters: free-text `q`, `category`, `shopId`.
 * Sort: "popular" (soldCount), "price_asc", "price_desc", "newest".
 * Premium-shop items are nudged up within the popular sort.
 */
export const listFood = query({
  args: {
    q: v.optional(v.string()),
    category: v.optional(v.string()),
    shopId: v.optional(v.id("shops")),
    sort: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const shops = await activeShopIds(ctx);

    let foods = await ctx.db
      .query("foodItems")
      .filter((f) => f.eq(f.field("status"), "published"))
      .collect();

    foods = foods.filter((f) => shops.has(f.shopId));
    if (args.shopId) foods = foods.filter((f) => f.shopId === args.shopId);
    if (args.category && args.category !== "All")
      foods = foods.filter((f) => f.category === args.category);
    if (args.q && args.q.trim()) {
      const needle = args.q.trim().toLowerCase();
      foods = foods.filter(
        (f) =>
          f.name.toLowerCase().includes(needle) ||
          f.tags.some((t) => t.toLowerCase().includes(needle)) ||
          (shops.get(f.shopId)?.name ?? "").toLowerCase().includes(needle)
      );
    }

    const sort = args.sort ?? "popular";
    foods.sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "newest") return b.createdAt - a.createdAt;
      // popular: featured shop first, then soldCount
      const af = shops.get(a.shopId)?.featured ? 1 : 0;
      const bf = shops.get(b.shopId)?.featured ? 1 : 0;
      if (af !== bf) return bf - af;
      return b.soldCount - a.soldCount;
    });

    const limited = args.limit ? foods.slice(0, args.limit) : foods;
    return limited.map((f) => {
      const shop = shops.get(f.shopId);
      return {
        ...f,
        shopName: shop?.name ?? "Kibanda",
        shopFeatured: shop?.featured ?? false,
        shopLocation: shop?.location ?? "",
      };
    });
  },
});

export const foodDetail = query({
  args: { foodId: v.id("foodItems") },
  handler: async (ctx, { foodId }) => {
    const food = await ctx.db.get(foodId);
    if (!food || food.status !== "published") return null;
    const shop = await ctx.db.get(food.shopId);
    if (!shop || !shop.active) return null;
    return { food, shop };
  },
});

/** Active shops for the marketplace shop directory. */
export const listShops = query({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, { q }) => {
    let shops = await ctx.db
      .query("shops")
      .withIndex("by_active", (s) => s.eq("active", true))
      .collect();
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      shops = shops.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.location.toLowerCase().includes(needle) ||
          s.categories.some((c) => c.toLowerCase().includes(needle))
      );
    }
    return shops.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.ratingAvg - a.ratingAvg;
    });
  },
});

/** Distinct categories present across published marketplace food. */
export const categories = query({
  args: {},
  handler: async (ctx) => {
    const foods = await ctx.db
      .query("foodItems")
      .filter((f) => f.eq(f.field("status"), "published"))
      .collect();
    return Array.from(new Set(foods.map((f) => f.category))).sort();
  },
});
