import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getSellerSubscription, hasActiveSubscription } from "./lib/rbac";

const DAY = 24 * 60 * 60 * 1000;

/** Everything the seller dashboard renders, computed server-side. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile || (profile.role !== "seller" && profile.role !== "admin")) {
      return null;
    }

    const now = Date.now();
    const sales = await ctx.db
      .query("sellerSales")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .collect();

    const within = (ms: number) =>
      sales.filter((s) => now - s.createdAt <= ms);
    const sum = (rows: typeof sales) => rows.reduce((n, s) => n + s.revenue, 0);
    const units = (rows: typeof sales) => rows.reduce((n, s) => n + s.qty, 0);

    const completed = sales.filter((s) => s.paymentStatus === "completed");
    const pending = sales.filter((s) => s.paymentStatus === "pending");

    const foods = await ctx.db
      .query("foodItems")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .collect();

    const bestSellers = [...foods]
      .filter((f) => f.soldCount > 0)
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, 5)
      .map((f) => ({ name: f.name, soldCount: f.soldCount, price: f.price }));

    const sub = await getSellerSubscription(ctx, userId);
    const active = await hasActiveSubscription(ctx, userId);
    const daysLeft =
      sub?.expiresAt ? Math.max(0, Math.ceil((sub.expiresAt - now) / DAY)) : 0;

    const recent = [...sales]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);

    return {
      sales: {
        today: sum(within(DAY)),
        week: sum(within(7 * DAY)),
        month: sum(within(30 * DAY)),
        totalRevenue: sum(sales),
        completedRevenue: sum(completed),
        pendingRevenue: sum(pending),
        estimatedProfit: sum(completed), // expenses default 0 until entered
        itemsSold: units(sales),
      },
      orders: {
        total: sales.length,
        completed: completed.length,
        pending: pending.length,
        cancelled: 0,
      },
      listings: {
        active: foods.filter(
          (f) => f.status === "published" && f.availability !== "sold_out"
        ).length,
        draft: foods.filter((f) => f.status === "draft").length,
        soldOut: foods.filter((f) => f.availability === "sold_out").length,
        total: foods.filter((f) => f.status !== "archived").length,
      },
      bestSellers,
      recent,
      subscription: {
        planKey: sub?.planKey ?? null,
        status: sub?.status ?? "none",
        active,
        daysLeft,
        expiringSoon: active && daysLeft <= 3,
      },
    };
  },
});
