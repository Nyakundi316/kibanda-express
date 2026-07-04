import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { getProfile, requireAuth } from "./lib/rbac";

/** Everything the client needs to render role-aware navigation. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const profile = await getProfile(ctx);

    let activeSubscription = false;
    let subscription = null;
    if (profile?.role === "seller" || profile?.role === "admin") {
      const subs = await ctx.db
        .query("sellerSubscriptions")
        .withIndex("by_seller", (q) => q.eq("sellerId", userId))
        .collect();
      subscription = subs.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
      activeSubscription = Boolean(
        subscription &&
          subscription.status === "active" &&
          subscription.expiresAt &&
          subscription.expiresAt > Date.now()
      );
    }

    return {
      userId,
      email: user?.email ?? null,
      name: user?.name ?? profile?.displayName ?? null,
      role: profile?.role ?? "customer",
      activeSubscription,
      subscription,
    };
  },
});

/**
 * Creates a default `customer` profile on first sign-in. Idempotent and safe to
 * call from the client — it can only ever create a customer, never a seller or
 * admin (those transitions happen server-side after payment / by an admin).
 */
export const ensureProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) return existing._id;

    return ctx.db.insert("profiles", {
      userId,
      role: "customer",
      createdAt: Date.now(),
    });
  },
});

export const updateMe = mutation({
  args: { displayName: v.optional(v.string()), phone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("No profile");
    await ctx.db.patch(profile._id, {
      ...(args.displayName !== undefined ? { displayName: args.displayName } : {}),
      ...(args.phone !== undefined ? { phone: args.phone } : {}),
    });
  },
});
