import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth, getSellerSubscription } from "./lib/rbac";
import { normalizeMsisdn } from "./lib/phone";
import { dispatch } from "./lib/notify";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Become-a-Seller entry point. Records the seller's business details, creates a
 * PENDING payment + PENDING subscription, and fires the M-Pesa STK push. It does
 * NOT grant the seller role or activate anything — that only happens when the
 * verified Daraja callback confirms the payment (resolveMpesaCallback).
 */
export const start = mutation({
  args: {
    planKey: v.string(),
    phone: v.string(),
    businessName: v.string(),
    ownerName: v.string(),
    location: v.string(),
    whatsapp: v.optional(v.string()),
    idNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Server-authoritative plan + price. The client never sends an amount.
    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_key", (q) => q.eq("key", args.planKey))
      .unique();
    if (!plan || !plan.active) throw new Error("Unknown subscription plan");

    const msisdn = normalizeMsisdn(args.phone);
    if (!msisdn) throw new Error("Enter a valid Safaricom number, e.g. 0712345678");

    // Block stacking a new payment when already actively subscribed.
    const current = await getSellerSubscription(ctx, userId);
    if (
      current &&
      current.status === "active" &&
      current.expiresAt &&
      current.expiresAt > Date.now()
    ) {
      throw new Error("You already have an active seller subscription");
    }

    // Make sure a profile row exists (stays `customer` until payment confirms).
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) {
      await ctx.db.insert("profiles", {
        userId,
        role: "customer",
        createdAt: Date.now(),
      });
    }

    // Upsert seller business details (verification pending).
    const sellerProfile = await ctx.db
      .query("sellerProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const sellerFields = {
      businessName: args.businessName,
      ownerName: args.ownerName,
      phone: msisdn,
      whatsapp: args.whatsapp,
      location: args.location,
      idNumber: args.idNumber,
    };
    if (sellerProfile) {
      await ctx.db.patch(sellerProfile._id, sellerFields);
    } else {
      await ctx.db.insert("sellerProfiles", {
        userId,
        ...sellerFields,
        verification: "pending",
        accountStatus: "active",
        createdAt: Date.now(),
      });
    }

    const now = Date.now();
    const paymentId = await ctx.db.insert("payments", {
      userId,
      kind: "subscription",
      amount: plan.price,
      currency: "KES",
      status: "pending",
      provider: "mpesa",
      phone: msisdn,
      planKey: plan.key,
      createdAt: now,
      updatedAt: now,
    });

    const subscriptionId = await ctx.db.insert("sellerSubscriptions", {
      sellerId: userId,
      planKey: plan.key,
      status: "pending",
      paymentId,
      createdAt: now,
    });
    await ctx.db.patch(paymentId, { subscriptionId });

    // Fire the real STK push out-of-band.
    await ctx.scheduler.runAfter(0, internal.mpesa.initiateStk, {
      paymentId,
      phone: msisdn,
      amount: plan.price,
      accountRef: `KIBANDA-${plan.key.toUpperCase()}`,
      description: `${plan.name} seller subscription`,
    });

    return { paymentId, subscriptionId };
  },
});

/** Current user's latest subscription + its payment, for the status screen. */
export const myStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const sub = await getSellerSubscription(ctx, userId);
    if (!sub) return null;

    const payment = sub.paymentId ? await ctx.db.get(sub.paymentId) : null;
    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_key", (q) => q.eq("key", sub.planKey))
      .unique();

    const active =
      sub.status === "active" && !!sub.expiresAt && sub.expiresAt > Date.now();
    const daysLeft = sub.expiresAt
      ? Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / DAY_MS))
      : 0;

    return {
      subscription: sub,
      payment: payment
        ? { status: payment.status, mpesaReceipt: payment.mpesaReceipt, resultDesc: payment.resultDesc }
        : null,
      planName: plan?.name ?? sub.planKey,
      active,
      daysLeft,
      expiringSoon: active && daysLeft <= 3,
    };
  },
});

// ---- internal mutations (called by the M-Pesa action / HTTP callback) ----

export const attachCheckout = internalMutation({
  args: {
    paymentId: v.id("payments"),
    merchantRequestId: v.string(),
    checkoutRequestId: v.string(),
  },
  handler: async (ctx, { paymentId, merchantRequestId, checkoutRequestId }) => {
    await ctx.db.patch(paymentId, {
      merchantRequestId,
      checkoutRequestId,
      status: "pending",
      updatedAt: Date.now(),
    });
  },
});

export const markPaymentUnconfigured = internalMutation({
  args: { paymentId: v.id("payments"), reason: v.string() },
  handler: async (ctx, { paymentId, reason }) => {
    await ctx.db.patch(paymentId, {
      status: "unconfigured",
      resultDesc: reason,
      updatedAt: Date.now(),
    });
  },
});

export const markPaymentFailed = internalMutation({
  args: { paymentId: v.id("payments"), reason: v.string() },
  handler: async (ctx, { paymentId, reason }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment || payment.status === "success") return;
    await ctx.db.patch(paymentId, {
      status: "failed",
      resultDesc: reason,
      updatedAt: Date.now(),
    });
    if (payment.subscriptionId) {
      const sub = await ctx.db.get(payment.subscriptionId);
      if (sub && sub.status === "pending") {
        await ctx.db.patch(sub._id, { status: "cancelled" });
      }
    }
  },
});

/**
 * THE activation gate. Looks up the payment by the checkout id Safaricom echoes
 * back, and only on ResultCode 0 does it mark the payment paid, activate the
 * subscription, and promote the user to `seller`.
 */
export const resolveMpesaCallback = internalMutation({
  args: {
    checkoutRequestId: v.string(),
    resultCode: v.number(),
    resultDesc: v.string(),
    mpesaReceipt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_checkout", (q) =>
        q.eq("checkoutRequestId", args.checkoutRequestId)
      )
      .unique();
    if (!payment) return; // unknown checkout id — ignore
    if (payment.status === "success") return; // idempotent

    const failed = args.resultCode !== 0;
    await ctx.db.patch(payment._id, {
      status: failed ? "failed" : "success",
      resultCode: args.resultCode,
      resultDesc: args.resultDesc,
      mpesaReceipt: args.mpesaReceipt,
      updatedAt: Date.now(),
    });

    // Customer order payment: reflect the result on the order either way —
    // a failed STK push must not leave the buyer staring at "Awaiting M-Pesa".
    if (payment.kind === "order") {
      if (!payment.orderId) return;
      const order = await ctx.db.get(payment.orderId);
      if (!order) return;

      if (!failed) {
        if (order.paymentStatus !== "paid") {
          await ctx.db.patch(order._id, { paymentStatus: "paid", updatedAt: Date.now() });
          await dispatch(ctx, {
            userId: order.customerId,
            orderId: order._id,
            kind: "payment_received",
            title: "Payment received",
            body: `M-Pesa payment for order ${order.reference} confirmed. Asante!`,
          });
        }
      } else if (order.paymentStatus === "pending") {
        await ctx.db.patch(order._id, { paymentStatus: "failed", updatedAt: Date.now() });
        await dispatch(ctx, {
          userId: order.customerId,
          orderId: order._id,
          kind: "payment_failed",
          title: "Payment didn't go through",
          body: `M-Pesa payment for order ${order.reference} failed (${args.resultDesc}). You can retry from the order page.`,
        });
      }
      return;
    }

    if (!payment.subscriptionId) return;
    const sub = await ctx.db.get(payment.subscriptionId);
    if (!sub) return;

    if (failed) {
      if (sub.status === "pending") {
        await ctx.db.patch(sub._id, { status: "cancelled" });
      }
      return;
    }

    // Success: activate the subscription for the plan's duration.
    const plan = await ctx.db
      .query("subscriptionPlans")
      .withIndex("by_key", (q) => q.eq("key", sub.planKey))
      .unique();
    const durationDays = plan?.durationDays ?? 1;
    const now = Date.now();
    // Extend from existing expiry if still in the future (renewals stack).
    const base =
      sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
    await ctx.db.patch(sub._id, {
      status: "active",
      startsAt: sub.startsAt ?? now,
      expiresAt: base + durationDays * DAY_MS,
    });

    // Promote to seller (never demote an existing admin).
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", payment.userId))
      .unique();
    if (profile && profile.role === "customer") {
      await ctx.db.patch(profile._id, { role: "seller" });
    } else if (!profile) {
      await ctx.db.insert("profiles", {
        userId: payment.userId,
        role: "seller",
        createdAt: now,
      });
    }
  },
});
