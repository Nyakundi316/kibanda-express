import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/rbac";
import { recordStatusChange } from "./lib/orderFlow";
import {
  orderStatusValidator,
  deliveryStatusValidator,
} from "./schema";
import { dispatch } from "./lib/notify";

async function logAdmin(
  ctx: any,
  adminId: Id<"users">,
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

const TERMINAL = ["completed", "cancelled", "rejected"];
// An order is "stuck" if it hasn't moved in this long while still active.
const STUCK_MS = 30 * 60 * 1000;

// ---- Orders overview -------------------------------------------------------

export const allOrders = query({
  args: {
    filter: v.optional(
      v.union(
        v.literal("all"),
        v.literal("active"),
        v.literal("delayed"),
        v.literal("late"),
        v.literal("stuck"),
        v.literal("disputed"),
        v.literal("cancelled"),
        v.literal("completed")
      )
    ),
  },
  handler: async (ctx, { filter = "active" }) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("marketplaceOrders").order("desc").take(200);
    const now = Date.now();

    const picked = orders.filter((o) => {
      const active = !TERMINAL.includes(o.status);
      switch (filter) {
        case "all":
          return true;
        case "active":
          return active;
        case "delayed":
          return active && (o.delayMinutes ?? 0) > 0;
        case "late":
          return active && !!o.estimatedArrivalAt && o.estimatedArrivalAt < now;
        case "stuck":
          return active && now - o.updatedAt > STUCK_MS;
        case "disputed":
          return !!o.disputeId;
        case "cancelled":
          return o.status === "cancelled" || o.status === "rejected";
        case "completed":
          return o.status === "completed";
        default:
          return active;
      }
    });

    return Promise.all(
      picked.map(async (o) => {
        let riderName: string | null = null;
        if (o.riderId) {
          const rp = await ctx.db
            .query("riderProfiles")
            .withIndex("by_user", (q) => q.eq("userId", o.riderId!))
            .unique();
          riderName = rp?.name ?? null;
        }
        return {
          ...o,
          riderName,
          isLate: !!o.estimatedArrivalAt && o.estimatedArrivalAt < now && !TERMINAL.includes(o.status),
        };
      })
    );
  },
});

// ---- Rider assignment ------------------------------------------------------

export const assignRider = mutation({
  args: { orderId: v.id("marketplaceOrders"), riderId: v.id("users") },
  handler: async (ctx, { orderId, riderId }) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.fulfilment !== "delivery") throw new Error("Pickup orders have no rider");

    const rp = await ctx.db
      .query("riderProfiles")
      .withIndex("by_user", (q) => q.eq("userId", riderId))
      .unique();
    if (!rp || rp.verification !== "approved")
      throw new Error("That rider isn't approved");

    // Cancel any prior open assignment (reassignment).
    const prior = await ctx.db
      .query("riderAssignments")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    await Promise.all(
      prior
        .filter((a) => a.status === "offered" || a.status === "accepted")
        .map((a) => ctx.db.patch(a._id, { status: "cancelled" }))
    );

    await ctx.db.insert("riderAssignments", {
      orderId,
      riderId,
      status: "offered",
      offeredBy: "admin",
      offeredAt: Date.now(),
    });

    await recordStatusChange(ctx, {
      order,
      axis: "delivery",
      to: "assigned",
      by: { role: "admin", userId: admin.userId },
      validate: false, // may be a reassignment from a mid-flight state
      extraPatch: { riderId },
      notify: false,
    });

    await dispatch(ctx, {
      userId: riderId,
      orderId,
      kind: "delivery_offer",
      title: "New delivery offer",
      body: `You've been offered order ${order.reference}. Open the rider app to accept.`,
    });
    await logAdmin(ctx, admin.userId, "assign_rider", "order", orderId, riderId);
  },
});

export const overrideStatus = mutation({
  args: {
    orderId: v.id("marketplaceOrders"),
    axis: v.union(v.literal("order"), v.literal("delivery")),
    orderStatus: v.optional(orderStatusValidator),
    deliveryStatus: v.optional(deliveryStatusValidator),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    const to = args.axis === "order" ? args.orderStatus : args.deliveryStatus;
    if (!to) throw new Error("Pick a target status");

    await recordStatusChange(ctx, {
      order,
      axis: args.axis,
      to,
      by: { role: "admin", userId: admin.userId },
      validate: false, // admin override deliberately bypasses the guard
      note: args.note ?? "Admin override",
    });
    await logAdmin(ctx, admin.userId, `override_${args.axis}`, "order", args.orderId, to);
  },
});

// ---- Riders ----------------------------------------------------------------

export const listRiders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const riders = await ctx.db.query("riderProfiles").collect();
    return Promise.all(
      riders.map(async (r) => {
        const active = await ctx.db
          .query("marketplaceOrders")
          .withIndex("by_rider", (q) => q.eq("riderId", r.userId))
          .collect();
        const live = active.filter(
          (o) => o.deliveryStatus && !["delivered", "failed"].includes(o.deliveryStatus)
        ).length;
        return { ...r, activeDeliveries: live };
      })
    );
  },
});

export const approveRider = mutation({
  args: { riderUserId: v.id("users"), approve: v.boolean() },
  handler: async (ctx, { riderUserId, approve }) => {
    const admin = await requireAdmin(ctx);
    const rp = await ctx.db
      .query("riderProfiles")
      .withIndex("by_user", (q) => q.eq("userId", riderUserId))
      .unique();
    if (!rp) throw new Error("Rider not found");
    await ctx.db.patch(rp._id, { verification: approve ? "approved" : "rejected" });

    if (approve) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", riderUserId))
        .unique();
      // Promote to rider (never demote an existing admin/seller silently — only
      // customers get upgraded here).
      if (profile && profile.role === "customer") {
        await ctx.db.patch(profile._id, { role: "rider" });
      } else if (!profile) {
        await ctx.db.insert("profiles", { userId: riderUserId, role: "rider", createdAt: Date.now() });
      }
      await dispatch(ctx, {
        userId: riderUserId,
        kind: "rider_approved",
        title: "You're approved!",
        body: "Your rider account is active. Open the rider dashboard to start delivering.",
      });
    }
    await logAdmin(ctx, admin.userId, approve ? "approve_rider" : "reject_rider", "rider", riderUserId);
  },
});

export const setRiderStatus = mutation({
  args: {
    riderUserId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("suspended")),
  },
  handler: async (ctx, { riderUserId, status }) => {
    const admin = await requireAdmin(ctx);
    const rp = await ctx.db
      .query("riderProfiles")
      .withIndex("by_user", (q) => q.eq("userId", riderUserId))
      .unique();
    if (!rp) throw new Error("Rider not found");
    await ctx.db.patch(rp._id, { accountStatus: status });
    await logAdmin(ctx, admin.userId, `rider_${status}`, "rider", riderUserId);
  },
});

// ---- Disputes --------------------------------------------------------------

export const listDisputes = query({
  args: { status: v.optional(v.union(v.literal("open"), v.literal("reviewing"), v.literal("resolved"))) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const disputes = status
      ? await ctx.db.query("orderDisputes").withIndex("by_status", (q) => q.eq("status", status)).order("desc").collect()
      : await ctx.db.query("orderDisputes").order("desc").take(100);
    return Promise.all(
      disputes.map(async (d) => {
        const order = await ctx.db.get(d.orderId);
        return { ...d, orderRef: order?.reference ?? "—", shopName: order?.shopName ?? "—" };
      })
    );
  },
});

export const resolveDispute = mutation({
  args: {
    disputeId: v.id("orderDisputes"),
    status: v.union(v.literal("reviewing"), v.literal("resolved")),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, { disputeId, status, resolution }) => {
    const admin = await requireAdmin(ctx);
    const dispute = await ctx.db.get(disputeId);
    if (!dispute) throw new Error("Dispute not found");
    await ctx.db.patch(disputeId, { status, resolution: resolution?.trim() || dispute.resolution });

    if (status === "resolved") {
      await dispatch(ctx, {
        userId: dispute.raisedById,
        orderId: dispute.orderId,
        kind: "dispute_resolved",
        title: "Issue resolved",
        body: resolution?.trim() || "Your reported issue has been resolved.",
      });
    }
    await logAdmin(ctx, admin.userId, `dispute_${status}`, "dispute", disputeId);
  },
});

// ---- Refunds (manual — no automated M-Pesa reversal) -----------------------

export const listRefunds = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.db.query("refunds").order("desc").take(100);
  },
});

export const createRefund = mutation({
  args: {
    orderId: v.id("marketplaceOrders"),
    amount: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, { orderId, amount, reason }) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    const refundId = await ctx.db.insert("refunds", {
      orderId,
      paymentId: order.paymentId,
      amount: amount ?? order.total,
      reason,
      status: "requested",
      requestedById: admin.userId,
      createdAt: Date.now(),
    });
    await logAdmin(ctx, admin.userId, "refund_requested", "order", orderId, reason);
    return refundId;
  },
});

export const markRefundProcessed = mutation({
  args: { refundId: v.id("refunds") },
  handler: async (ctx, { refundId }) => {
    const admin = await requireAdmin(ctx);
    const refund = await ctx.db.get(refundId);
    if (!refund) throw new Error("Refund not found");
    await ctx.db.patch(refundId, { status: "processed", processedById: admin.userId });
    const order = await ctx.db.get(refund.orderId);
    if (order) {
      await ctx.db.patch(order._id, { paymentStatus: "refunded", updatedAt: Date.now() });
      await dispatch(ctx, {
        userId: order.customerId,
        orderId: order._id,
        kind: "refunded",
        title: "Refund processed",
        body: `A refund of KSh ${refund.amount} has been processed for order ${order.reference}.`,
      });
    }
    await logAdmin(ctx, admin.userId, "refund_processed", "refund", refundId);
  },
});
