import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAuth, requireRole } from "./lib/rbac";
import { orderStatusValidator } from "./schema";
import { normalizeMsisdn } from "./lib/phone";
import { recordSalesForOrder } from "./lib/sales";
import { recordStatusChange, computeEta } from "./lib/orderFlow";
import { dispatch } from "./lib/notify";

const DELIVERY_FEE = 80;
const SERVICE_FEE = 25;

const ref = () =>
  "KE-" + Math.random().toString(36).slice(2, 6).toUpperCase();

/**
 * Place orders from the signed-in user's cart. Totals are computed entirely
 * server-side from current DB prices. A multi-shop cart becomes one order per
 * shop. With M-Pesa selected, an STK push is fired per order; the order is only
 * marked paid by the verified callback.
 */
export const checkout = mutation({
  args: {
    fulfilment: v.union(v.literal("delivery"), v.literal("pickup")),
    paymentMethod: v.union(v.literal("mpesa"), v.literal("cash")),
    customerName: v.string(),
    customerPhone: v.string(),
    address: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!args.customerName.trim()) throw new Error("Enter your name");
    if (args.fulfilment === "delivery" && !args.address?.trim())
      throw new Error("Enter a delivery address");

    const msisdn = normalizeMsisdn(args.customerPhone);
    if (!msisdn) throw new Error("Enter a valid phone, e.g. 0712345678");

    const lines = await ctx.db
      .query("cartLines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (lines.length === 0) throw new Error("Your cart is empty");

    // Group by shop (legacy lines without a shop share the "unrouted" bucket).
    const groups = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = line.shopId ?? "unrouted";
      const list = groups.get(key) ?? [];
      list.push(line);
      groups.set(key, list);
    }

    const now = Date.now();
    const created: { orderId: Id<"marketplaceOrders">; reference: string; total: number }[] = [];

    for (const group of Array.from(groups.values())) {
      let subtotal = 0;
      const items: {
        foodId?: any;
        name: string;
        image: string;
        unitPrice: number;
        qty: number;
        lineTotal: number;
      }[] = [];

      let shopId: Id<"shops"> | undefined = undefined;
      let sellerId: Id<"users"> | undefined = undefined;
      let shopName = group[0].vendor;

      for (const line of group) {
        let unitPrice = line.price;
        let name = line.name;
        let image = line.image;

        // Re-price real food items from the DB; reject if gone/unavailable.
        const fid = line.foodId;
        if (fid) {
          const food = await ctx.db.get(fid);
          if (!food || food.status !== "published" || food.availability !== "available")
            throw new Error(`"${line.name}" is no longer available`);
          unitPrice = food.price;
          name = food.name;
          image = food.image ?? "";
          shopId = food.shopId;
          sellerId = food.sellerId;
          const shop = await ctx.db.get(food.shopId);
          if (shop) shopName = shop.name;
        }

        const lineTotal = unitPrice * line.qty;
        subtotal += lineTotal;
        items.push({ foodId: line.foodId, name, image, unitPrice, qty: line.qty, lineTotal });
      }

      const deliveryFee = args.fulfilment === "delivery" ? DELIVERY_FEE : 0;
      const total = subtotal + deliveryFee + SERVICE_FEE;

      const orderId = await ctx.db.insert("marketplaceOrders", {
        reference: ref(),
        customerId: userId,
        shopId,
        sellerId,
        shopName,
        status: "pending",
        fulfilment: args.fulfilment,
        deliveryStatus: args.fulfilment === "delivery" ? "unassigned" : undefined,
        customerName: args.customerName.trim(),
        customerPhone: msisdn,
        address: args.address?.trim() || undefined,
        note: args.note?.trim() || undefined,
        subtotal,
        deliveryFee,
        serviceFee: SERVICE_FEE,
        total,
        paymentMethod: args.paymentMethod,
        paymentStatus: "pending",
        salesRecorded: false,
        createdAt: now,
        updatedAt: now,
      });

      for (const it of items) {
        await ctx.db.insert("marketplaceOrderItems", { orderId, ...it });
      }

      if (args.paymentMethod === "mpesa") {
        const paymentId = await ctx.db.insert("payments", {
          userId,
          kind: "order",
          amount: total,
          currency: "KES",
          status: "pending",
          provider: "mpesa",
          phone: msisdn,
          orderId,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.patch(orderId, { paymentId });
        await ctx.scheduler.runAfter(0, internal.mpesa.initiateStk, {
          paymentId,
          phone: msisdn,
          amount: total,
          accountRef: `ORDER-${shopName}`.slice(0, 12),
          description: "Kibanda order",
        });
      }

      const order = await ctx.db.get(orderId);
      // Seed the ETA + first audit row, and alert both parties.
      await ctx.db.patch(orderId, { estimatedArrivalAt: computeEta(order!) });
      await ctx.db.insert("orderStatusHistory", {
        orderId,
        axis: "order",
        newValue: "pending",
        changedByRole: "customer",
        changedById: userId,
        note: "Order placed",
        createdAt: now,
      });
      await dispatch(ctx, {
        userId,
        orderId,
        kind: "order_placed",
        title: "Order placed",
        body: `Your order ${order!.reference} with ${shopName} has been placed.`,
      });
      if (sellerId) {
        await dispatch(ctx, {
          userId: sellerId,
          orderId,
          kind: "new_order",
          title: "New order received",
          body: `New order ${order!.reference} • ${args.fulfilment} • KSh ${total}.`,
        });
      }
      created.push({ orderId, reference: order!.reference, total });
    }

    // Empty the cart now that orders exist.
    await Promise.all(lines.map((l) => ctx.db.delete(l._id)));

    return created;
  },
});

async function withItems(ctx: QueryCtx, order: Doc<"marketplaceOrders">) {
  const items = await ctx.db
    .query("marketplaceOrderItems")
    .withIndex("by_order", (q) => q.eq("orderId", order._id))
    .collect();
  return { ...order, items };
}

/** Customer's own orders (newest first). */
export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const orders = await ctx.db
      .query("marketplaceOrders")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .order("desc")
      .collect();
    return Promise.all(orders.map((o) => withItems(ctx, o)));
  },
});

export const orderDetail = query({
  args: { orderId: v.id("marketplaceOrders") },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    // Only the customer or the order's seller may view it.
    if (order.customerId !== userId && order.sellerId !== userId) return null;
    return withItems(ctx, order);
  },
});

/** Seller's incoming orders, with the assigned rider's contact (own orders). */
export const forSeller = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const orders = await ctx.db
      .query("marketplaceOrders")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .order("desc")
      .collect();
    return Promise.all(
      orders.map(async (o) => {
        const base = await withItems(ctx, o);
        let rider: { name: string; phone: string } | null = null;
        if (o.riderId) {
          const rp = await ctx.db
            .query("riderProfiles")
            .withIndex("by_user", (q) => q.eq("userId", o.riderId!))
            .unique();
          if (rp) rider = { name: rp.name, phone: rp.phone };
        }
        return { ...base, rider };
      })
    );
  },
});

/**
 * Seller (or admin) advances the kitchen axis: pending → accepted → preparing
 * → ready, plus reject. Transitions are validated in `recordStatusChange` via
 * ORDER_NEXT — no stage-skipping. Delivery orders are completed by the rider,
 * not here; pickup orders are handed over with `completed`.
 */
export const updateStatus = mutation({
  args: { orderId: v.id("marketplaceOrders"), status: orderStatusValidator },
  handler: async (ctx, { orderId, status }) => {
    const profile = await requireRole(ctx, "seller", "admin");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.sellerId !== profile.userId && profile.role !== "admin")
      throw new Error("This isn't your order");

    if (
      status === "completed" &&
      order.fulfilment === "delivery" &&
      order.deliveryStatus !== "delivered" &&
      profile.role !== "admin"
    ) {
      throw new Error("Delivery orders complete when the rider marks them delivered");
    }

    await recordStatusChange(ctx, {
      order,
      axis: "order",
      to: status,
      by: { role: profile.role, userId: profile.userId },
    });

    // Handover/completion: record sales once, settle cash payment.
    if (status === "completed") {
      const fresh = await ctx.db.get(orderId);
      const recorded = fresh ? await recordSalesForOrder(ctx, fresh) : false;
      await ctx.db.patch(orderId, {
        paymentStatus: "paid",
        ...(recorded ? { salesRecorded: true } : {}),
      });
    }
  },
});

/** Seller sets/updates the preparation estimate; ETA is recomputed. */
export const setPrepTime = mutation({
  args: { orderId: v.id("marketplaceOrders"), minutes: v.number() },
  handler: async (ctx, { orderId, minutes }) => {
    const profile = await requireRole(ctx, "seller", "admin");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    if (order.sellerId !== profile.userId && profile.role !== "admin")
      throw new Error("This isn't your order");
    const m = Math.max(1, Math.min(240, Math.round(minutes)));
    const merged = { ...order, prepTimeMins: m };
    await ctx.db.patch(orderId, {
      prepTimeMins: m,
      estimatedArrivalAt: computeEta(merged),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Customer self-cancel — only before the kitchen starts cooking. Once
 * `preparing`, the customer must Report a problem (opens a dispute) so the
 * seller/admin can approve, matching the cancellation rules.
 */
export const cancelOrder = mutation({
  args: { orderId: v.id("marketplaceOrders") },
  handler: async (ctx, { orderId }) => {
    const userId = await requireAuth(ctx);
    const order = await ctx.db.get(orderId);
    if (!order || order.customerId !== userId)
      throw new Error("Order not found");
    if (!["pending", "accepted"].includes(order.status))
      throw new Error("This order can no longer be cancelled — report a problem instead");
    await recordStatusChange(ctx, {
      order,
      axis: "order",
      to: "cancelled",
      by: { role: "customer", userId },
    });
  },
});
