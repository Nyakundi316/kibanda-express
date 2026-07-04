import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { requireAuth, getProfile } from "./lib/rbac";
import { dispatch } from "./lib/notify";

// Delivery states where the rider is actively handling the order — the only
// window in which their contact details are exposed to the customer.
const ACTIVE_DELIVERY = new Set([
  "assigned",
  "rider_accepted",
  "going_to_seller",
  "at_seller",
  "picked_up",
  "on_the_way",
  "near_customer",
]);

/**
 * Everything the customer tracking page needs in one shot. Ownership-checked:
 * only the customer who placed it (or an admin) may read it. Rider contact is
 * withheld once the delivery is finished — privacy rule.
 */
export const trackOrder = query({
  // Accepts a raw string because the id comes straight from the URL — garbage
  // input renders "Order not found" instead of a validation error.
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const orderId = ctx.db.normalizeId("marketplaceOrders", args.orderId);
    if (!orderId) return null;
    const order = await ctx.db.get(orderId);
    if (!order) return null;

    const profile = await getProfile(ctx);
    const isAdmin = profile?.role === "admin";
    if (order.customerId !== userId && !isAdmin) return null;

    const items = await ctx.db
      .query("marketplaceOrderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();

    const timeline = await ctx.db
      .query("orderStatusHistory")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    timeline.sort((a, b) => a.createdAt - b.createdAt);

    // Seller public contact.
    let seller: { name: string; phone: string | null } | null = null;
    if (order.shopId) {
      const shop = await ctx.db.get(order.shopId);
      if (shop) seller = { name: shop.name, phone: shop.phone };
    }
    if (!seller) seller = { name: order.shopName, phone: null };

    // Rider public contact — only while the delivery is live.
    let rider:
      | { name: string; phone: string; vehicleType: string; vehiclePlate?: string }
      | null = null;
    const deliveryActive =
      order.deliveryStatus && ACTIVE_DELIVERY.has(order.deliveryStatus);
    if (order.riderId && deliveryActive) {
      const rp = await ctx.db
        .query("riderProfiles")
        .withIndex("by_user", (q) => q.eq("userId", order.riderId!))
        .unique();
      if (rp) {
        rider = {
          name: rp.name,
          phone: rp.phone,
          vehicleType: rp.vehicleType,
          vehiclePlate: rp.vehiclePlate,
        };
      }
    }

    const canCancel = ["pending", "accepted"].includes(order.status);
    const dispute = order.disputeId ? await ctx.db.get(order.disputeId) : null;

    return {
      order,
      items,
      timeline,
      seller,
      rider,
      canCancel,
      dispute: dispute ? { status: dispute.status, reason: dispute.reason } : null,
    };
  },
});

const REPORT_REASONS = [
  "Order is taking too long",
  "Wrong or missing items",
  "Food quality issue",
  "Rider can't find me",
  "Payment issue",
  "Other",
] as const;

/**
 * Customer reports a problem. Opens a dispute (admin-resolvable) and links it to
 * the order without forcing the order status — delivery can still proceed or be
 * resolved. Notifies the customer that it was logged.
 */
export const reportProblem = mutation({
  args: {
    orderId: v.id("marketplaceOrders"),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, reason, details }) => {
    const userId = await requireAuth(ctx);
    const order = await ctx.db.get(orderId);
    if (!order || order.customerId !== userId) throw new Error("Order not found");
    if (!REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number]))
      throw new Error("Pick a valid reason");

    const profile = await getProfile(ctx);
    const disputeId = await ctx.db.insert("orderDisputes", {
      orderId,
      raisedById: userId,
      raisedByRole: profile?.role ?? "customer",
      reason,
      details: details?.trim() || undefined,
      status: "open",
      createdAt: Date.now(),
    });
    await ctx.db.patch(orderId, { disputeId, updatedAt: Date.now() });

    await dispatch(ctx, {
      userId,
      orderId,
      kind: "problem_reported",
      title: "Problem reported",
      body: "Thanks — we've logged your issue and our team will look into it.",
    });

    return disputeId;
  },
});

/** Exposed so the client can render the same canonical reason list. */
export const reportReasons = query({
  args: {},
  handler: async () => REPORT_REASONS as unknown as string[],
});
