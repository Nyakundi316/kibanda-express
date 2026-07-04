import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/rbac";

const DEFAULT_PLANS = [
  {
    key: "daily",
    name: "Daily Trader",
    price: 300,
    durationDays: 1,
    maxListings: 20,
    premium: false,
    features: [
      "Sell for 24 hours",
      "Up to 20 food listings",
      "Order management",
      "Basic sales dashboard",
    ],
    active: true,
  },
  {
    key: "monthly",
    name: "Monthly Kibanda",
    price: 4500,
    durationDays: 30,
    maxListings: 60,
    premium: false,
    features: [
      "Sell for 30 days",
      "Up to 60 food listings",
      "Order management",
      "Sales & profit reports",
      "Save ~50% vs daily",
    ],
    active: true,
  },
  {
    key: "premium",
    name: "Premium Annual",
    price: 45000,
    durationDays: 365,
    maxListings: 1000,
    premium: true,
    features: [
      "Sell for a full year",
      "Unlimited-ish listings (1000)",
      "Featured shop + priority search",
      "Verified premium badge",
      "Advanced analytics & customer insights",
      "Coupons, boosts & shop customization",
    ],
    active: true,
  },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("subscriptionPlans").collect();
    return plans
      .filter((p) => p.active)
      .sort((a, b) => a.price - b.price);
  },
});

/** Idempotent: inserts the default plans the first time, no-ops afterwards. */
export const ensureDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    for (const plan of DEFAULT_PLANS) {
      const existing = await ctx.db
        .query("subscriptionPlans")
        .withIndex("by_key", (q) => q.eq("key", plan.key))
        .unique();
      if (!existing) await ctx.db.insert("subscriptionPlans", plan);
    }
  },
});

/** Admin-only: toggle / reprice plans. */
export const setActive = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Placeholder for admin plan management UI; kept minimal for now.
  },
});
