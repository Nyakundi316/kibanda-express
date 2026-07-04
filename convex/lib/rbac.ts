import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;
export type Role = "customer" | "seller" | "rider" | "admin";

/** Throws if nobody is signed in; otherwise returns the auth user id. */
export async function requireAuth(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** Current user's profile, or null when not signed in / not yet bootstrapped. */
export async function getProfile(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireProfile(ctx: Ctx) {
  const profile = await getProfile(ctx);
  if (!profile) throw new Error("No profile — please sign in again");
  return profile;
}

export async function requireRole(ctx: Ctx, ...roles: Role[]) {
  const profile = await requireProfile(ctx);
  if (!roles.includes(profile.role)) {
    throw new Error(`Forbidden: requires role ${roles.join(" or ")}`);
  }
  return profile;
}

export const requireAdmin = (ctx: Ctx) => requireRole(ctx, "admin");

/** Riders manage deliveries; admins can act on their behalf for support. */
export const requireRider = (ctx: Ctx) => requireRole(ctx, "rider", "admin");

/** The seller's current subscription row (latest), regardless of status. */
export async function getSellerSubscription(ctx: Ctx, sellerId: Id<"users">) {
  const subs = await ctx.db
    .query("sellerSubscriptions")
    .withIndex("by_seller", (q) => q.eq("sellerId", sellerId))
    .collect();
  return subs.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

/** True only when an active subscription exists and has not expired. */
export async function hasActiveSubscription(ctx: Ctx, sellerId: Id<"users">) {
  const sub = await getSellerSubscription(ctx, sellerId);
  return Boolean(
    sub &&
      sub.status === "active" &&
      sub.expiresAt &&
      sub.expiresAt > Date.now()
  );
}

/**
 * Gate for selling actions (add/edit food, etc.). Requires the seller role AND
 * a live subscription. An expired seller keeps their shop visible but cannot
 * pass this gate — enforced on the server, never the client.
 */
export async function requireActiveSeller(ctx: Ctx) {
  const profile = await requireRole(ctx, "seller", "admin");
  // Admins bypass the subscription paywall for support actions.
  if (profile.role === "admin") return profile;
  if (!(await hasActiveSubscription(ctx, profile.userId))) {
    throw new Error("Your seller subscription is not active");
  }
  return profile;
}
