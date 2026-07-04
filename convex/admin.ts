import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAdmin, getSellerSubscription } from "./lib/rbac";

async function log(
  ctx: any,
  adminId: any,
  action: string,
  targetType: string,
  targetId: string,
  note?: string
) {
  await ctx.db.insert("adminActions", {
    adminId,
    action,
    targetType,
    targetId,
    note,
    createdAt: Date.now(),
  });
}

/**
 * One-time admin bootstrap. Requires ADMIN_BOOTSTRAP_SECRET to be set on the
 * deployment AND supplied by the caller — so admin rights can never be granted
 * by a normal client guessing an endpoint. Returns false if the secret is unset
 * or wrong (no insecure default).
 */
export const claimAdmin = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    const userId = await requireAuth(ctx);
    const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expected || secret !== expected) return false;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { role: "admin" });
    else
      await ctx.db.insert("profiles", {
        userId,
        role: "admin",
        createdAt: Date.now(),
      });
    await log(ctx, userId, "claim_admin", "user", userId);
    return true;
  },
});

export const listSellers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const sellers = await ctx.db.query("sellerProfiles").collect();
    return Promise.all(
      sellers.map(async (s) => {
        const sub = await getSellerSubscription(ctx, s.userId);
        const shop = await ctx.db
          .query("shops")
          .withIndex("by_owner", (q) => q.eq("ownerId", s.userId))
          .unique();
        return {
          ...s,
          subscription: sub
            ? {
                planKey: sub.planKey,
                status: sub.status,
                expiresAt: sub.expiresAt ?? null,
                active:
                  sub.status === "active" &&
                  !!sub.expiresAt &&
                  sub.expiresAt > Date.now(),
              }
            : null,
          shopName: shop?.name ?? null,
          shopActive: shop?.active ?? false,
        };
      })
    );
  },
});

export const listSubscriptionPayments = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const payments = await ctx.db.query("payments").collect();
    return payments
      .filter((p) => p.kind === "subscription")
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const platformStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [profiles, sellers, shops, foods, payments] = await Promise.all([
      ctx.db.query("profiles").collect(),
      ctx.db.query("sellerProfiles").collect(),
      ctx.db.query("shops").collect(),
      ctx.db.query("foodItems").collect(),
      ctx.db.query("payments").collect(),
    ]);
    const subRevenue = payments
      .filter((p) => p.kind === "subscription" && p.status === "success")
      .reduce((n, p) => n + p.amount, 0);
    return {
      customers: profiles.filter((p) => p.role === "customer").length,
      sellers: sellers.length,
      admins: profiles.filter((p) => p.role === "admin").length,
      shops: shops.length,
      activeShops: shops.filter((s) => s.active).length,
      foodListings: foods.length,
      subscriptionRevenue: subRevenue,
    };
  },
});

export const setSellerAccountStatus = mutation({
  args: {
    sellerUserId: v.id("users"),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("banned")
    ),
  },
  handler: async (ctx, { sellerUserId, status }) => {
    const admin = await requireAdmin(ctx);
    const sp = await ctx.db
      .query("sellerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", sellerUserId))
      .unique();
    if (!sp) throw new Error("Seller not found");
    await ctx.db.patch(sp._id, { accountStatus: status });

    // Suspending/banning also hides their shop.
    if (status !== "active") {
      const shop = await ctx.db
        .query("shops")
        .withIndex("by_owner", (q) => q.eq("ownerId", sellerUserId))
        .unique();
      if (shop) await ctx.db.patch(shop._id, { active: false });
    }
    await log(ctx, admin.userId, `seller_${status}`, "seller", sellerUserId);
  },
});

export const setVerification = mutation({
  args: {
    sellerUserId: v.id("users"),
    verification: v.union(v.literal("verified"), v.literal("rejected")),
  },
  handler: async (ctx, { sellerUserId, verification }) => {
    const admin = await requireAdmin(ctx);
    const sp = await ctx.db
      .query("sellerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", sellerUserId))
      .unique();
    if (!sp) throw new Error("Seller not found");
    await ctx.db.patch(sp._id, { verification });
    await log(ctx, admin.userId, `verify_${verification}`, "seller", sellerUserId);
  },
});
