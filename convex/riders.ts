import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireAuth, requireRole, requireRider } from "./lib/rbac";
import { recordStatusChange, computeEta } from "./lib/orderFlow";
import { recordSalesForOrder } from "./lib/sales";
import { dispatch } from "./lib/notify";

const vehicleValidator = v.union(
  v.literal("motorbike"),
  v.literal("bicycle"),
  v.literal("car"),
  v.literal("on_foot")
);

const DELAY_REASONS = [
  "Seller needs more time",
  "Traffic",
  "Rider unavailable",
  "Customer unreachable",
  "Weather",
  "Payment confirmation delay",
] as const;

// ---- Onboarding ------------------------------------------------------------

/**
 * Apply to become a rider. Records a PENDING rider profile — it does NOT grant
 * the rider role. An admin must approve (riders.approveRider) which flips the
 * `profiles` role to "rider". Mirrors the become-seller → admin-verify flow.
 */
export const apply = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    vehicleType: vehicleValidator,
    vehiclePlate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!args.name.trim()) throw new Error("Enter your name");
    if (!args.phone.trim()) throw new Error("Enter your phone number");

    // Ensure a profile row exists (stays "customer" until admin approval).
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      await ctx.db.insert("profiles", { userId, role: "customer", createdAt: Date.now() });
    }

    const existing = await ctx.db
      .query("riderProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const fields = {
      name: args.name.trim(),
      phone: args.phone.trim(),
      vehicleType: args.vehicleType,
      vehiclePlate: args.vehiclePlate?.trim() || undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return ctx.db.insert("riderProfiles", {
      userId,
      ...fields,
      verification: "pending",
      accountStatus: "active",
      availability: "offline",
      createdAt: Date.now(),
    });
  },
});

/** The signed-in user's rider profile + approval state, for the apply screen. */
export const myRiderProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query("riderProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const setAvailability = mutation({
  args: { availability: v.union(v.literal("online"), v.literal("offline")) },
  handler: async (ctx, { availability }) => {
    const profile = await requireRider(ctx);
    const rp = await ctx.db
      .query("riderProfiles")
      .withIndex("by_user", (q) => q.eq("userId", profile.userId))
      .unique();
    if (!rp) throw new Error("No rider profile");
    await ctx.db.patch(rp._id, { availability });
  },
});

// ---- Helpers ---------------------------------------------------------------

async function orderForRider(ctx: MutationCtx, orderId: Id<"marketplaceOrders">) {
  const profile = await requireRider(ctx);
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");
  if (order.riderId !== profile.userId && profile.role !== "admin")
    throw new Error("This delivery isn't assigned to you");
  return { profile, order };
}

async function riderName(ctx: MutationCtx, userId?: Id<"users">): Promise<string | undefined> {
  if (!userId) return undefined;
  const rp = await ctx.db
    .query("riderProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return rp?.name;
}

async function attachOrderView(ctx: any, order: Doc<"marketplaceOrders">, full: boolean) {
  const items = await ctx.db
    .query("marketplaceOrderItems")
    .withIndex("by_order", (q: any) => q.eq("orderId", order._id))
    .collect();
  let sellerPhone: string | null = null;
  let sellerLocation: string | null = null;
  if (order.shopId) {
    const shop = await ctx.db.get(order.shopId);
    if (shop) {
      sellerPhone = shop.phone;
      sellerLocation = shop.location;
    }
  }
  return {
    ...order,
    items,
    sellerPhone,
    sellerLocation,
    // Customer phone only on accepted deliveries (privacy in the open pool).
    customerPhone: full ? order.customerPhone : null,
  };
}

// ---- Rider queries ---------------------------------------------------------

/** Orders currently assigned to me (active + recently delivered). */
export const myDeliveries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const orders = await ctx.db
      .query("marketplaceOrders")
      .withIndex("by_rider", (q) => q.eq("riderId", userId))
      .order("desc")
      .collect();
    return Promise.all(orders.map((o) => attachOrderView(ctx, o, true)));
  },
});

/** Unassigned delivery orders that are ready/preparing — the claimable pool. */
export const availableDeliveries = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, "rider", "admin");
    const orders = await ctx.db
      .query("marketplaceOrders")
      .withIndex("by_delivery_status", (q) => q.eq("deliveryStatus", "unassigned"))
      .collect();
    const open = orders.filter(
      (o) => o.fulfilment === "delivery" && ["preparing", "ready"].includes(o.status)
    );
    return Promise.all(open.map((o) => attachOrderView(ctx, o, false)));
  },
});

// ---- Assignment ------------------------------------------------------------

/** Rider self-claims an open delivery. */
export const claimDelivery = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: async (ctx, { orderId }) => {
    const profile = await requireRole(ctx, "rider", "admin");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.fulfilment !== "delivery") throw new Error("This is a pickup order");
    if (order.deliveryStatus && order.deliveryStatus !== "unassigned")
      throw new Error("This delivery has already been taken");

    await ctx.db.insert("riderAssignments", {
      orderId,
      riderId: profile.userId,
      status: "accepted",
      offeredBy: "self",
      offeredAt: Date.now(),
      respondedAt: Date.now(),
    });

    await recordStatusChange(ctx, {
      order,
      axis: "delivery",
      to: "rider_accepted",
      by: { role: "rider", userId: profile.userId },
      extraPatch: { riderId: profile.userId },
      riderName: await riderName(ctx, profile.userId),
    });
  },
});

/** Rider responds to an admin-created offer. */
export const respondToOffer = mutation({
  args: { orderId: v.id("marketplaceOrders"), accept: v.boolean() },
  handler: async (ctx, { orderId, accept }) => {
    const profile = await requireRole(ctx, "rider", "admin");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.riderId !== profile.userId)
      throw new Error("This offer isn't for you");

    const assignment = await ctx.db
      .query("riderAssignments")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .filter((q) => q.eq(q.field("riderId"), profile.userId))
      .order("desc")
      .first();

    if (accept) {
      if (assignment) await ctx.db.patch(assignment._id, { status: "accepted", respondedAt: Date.now() });
      await recordStatusChange(ctx, {
        order,
        axis: "delivery",
        to: "rider_accepted",
        by: { role: "rider", userId: profile.userId },
        riderName: await riderName(ctx, profile.userId),
      });
    } else {
      if (assignment) await ctx.db.patch(assignment._id, { status: "rejected", respondedAt: Date.now() });
      await recordStatusChange(ctx, {
        order,
        axis: "delivery",
        to: "unassigned",
        by: { role: "rider", userId: profile.userId },
        extraPatch: { riderId: undefined },
        notify: false,
      });
    }
  },
});

// ---- Stage flow ------------------------------------------------------------

async function advance(
  ctx: MutationCtx,
  orderId: Id<"marketplaceOrders">,
  to: string
) {
  const { profile, order } = await orderForRider(ctx, orderId);
  await recordStatusChange(ctx, {
    order,
    axis: "delivery",
    to,
    by: { role: "rider", userId: profile.userId },
    riderName: await riderName(ctx, order.riderId),
  });
}

export const goingToSeller = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: (ctx, { orderId }) => advance(ctx, orderId, "going_to_seller"),
});
export const arrivedAtSeller = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: (ctx, { orderId }) => advance(ctx, orderId, "at_seller"),
});
export const pickedUp = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: (ctx, { orderId }) => advance(ctx, orderId, "picked_up"),
});
export const onTheWay = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: (ctx, { orderId }) => advance(ctx, orderId, "on_the_way"),
});
export const nearCustomer = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: (ctx, { orderId }) => advance(ctx, orderId, "near_customer"),
});

/** Final step: delivery confirmed → order completed, sales recorded once. */
export const markDelivered = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: async (ctx, { orderId }) => {
    const { profile, order } = await orderForRider(ctx, orderId);

    await recordStatusChange(ctx, {
      order,
      axis: "delivery",
      to: "delivered",
      by: { role: "rider", userId: profile.userId },
      riderName: await riderName(ctx, order.riderId),
    });

    const afterDelivery = await ctx.db.get(orderId);
    if (afterDelivery && afterDelivery.status !== "completed") {
      await recordStatusChange(ctx, {
        order: afterDelivery,
        axis: "order",
        to: "completed",
        by: { role: "rider", userId: profile.userId },
        validate: false, // delivery-driven completion regardless of kitchen state
        notify: false, // delivered message already sent
      });
      const fresh = await ctx.db.get(orderId);
      const recorded = fresh ? await recordSalesForOrder(ctx, fresh) : false;
      await ctx.db.patch(orderId, {
        paymentStatus: "paid",
        ...(recorded ? { salesRecorded: true } : {}),
      });
    }

    const assignment = await ctx.db
      .query("riderAssignments")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .filter((q) => q.eq(q.field("riderId"), profile.userId))
      .order("desc")
      .first();
    if (assignment) await ctx.db.patch(assignment._id, { status: "completed", completedAt: Date.now() });
  },
});

/** Rider (or seller/admin) reports a delay; ETA bumps and the customer hears. */
export const reportDelay = mutation({
  args: {
    orderId: v.id("marketplaceOrders"),
    minutes: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { orderId, minutes, reason }) => {
    const profile = await requireRole(ctx, "rider", "seller", "admin");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    const ownsAsRider = order.riderId === profile.userId;
    const ownsAsSeller = order.sellerId === profile.userId;
    if (profile.role !== "admin" && !ownsAsRider && !ownsAsSeller)
      throw new Error("Not your order");
    if (!DELAY_REASONS.includes(reason as (typeof DELAY_REASONS)[number]))
      throw new Error("Pick a valid delay reason");

    const mins = Math.max(1, Math.min(120, Math.round(minutes)));
    const merged = { ...order, delayMinutes: (order.delayMinutes ?? 0) + mins };
    await ctx.db.patch(orderId, {
      delayMinutes: merged.delayMinutes,
      delayReason: reason,
      estimatedArrivalAt: computeEta(merged as Doc<"marketplaceOrders">),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("orderStatusHistory", {
      orderId,
      axis: "delivery",
      newValue: order.deliveryStatus ?? "unassigned",
      changedByRole: profile.role,
      changedById: profile.userId,
      note: `Delayed ~${mins} min: ${reason}`,
      createdAt: Date.now(),
    });
    await dispatch(ctx, {
      userId: order.customerId,
      orderId,
      kind: "delayed",
      title: "Delivery delayed",
      body: `Your order is delayed by about ${mins} minutes (${reason}). Updated ETA shown in the app.`,
    });
  },
});

/**
 * GPS beacon target — called by the rider dashboard's "Share live location"
 * toggle; the customer map reads it via orderTracking.riderLocation.
 * Refuses to store a location once the delivery is finished (privacy rule).
 */
export const updateLocation = mutation({
  args: { orderId: v.id("marketplaceOrders"), lat: v.number(), lng: v.number() },
  handler: async (ctx, { orderId, lat, lng }) => {
    const { profile, order } = await orderForRider(ctx, orderId);
    if (!order.deliveryStatus || ["delivered", "failed"].includes(order.deliveryStatus))
      throw new Error("Delivery is not active");
    const existing = await ctx.db
      .query("riderLocations")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lat, lng, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("riderLocations", {
        riderId: profile.userId,
        orderId,
        lat,
        lng,
        updatedAt: Date.now(),
      });
    }
  },
});

export const delayReasons = query({
  args: {},
  handler: async () => DELAY_REASONS as unknown as string[],
});
