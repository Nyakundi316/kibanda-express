import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { dispatch } from "./notify";

export type Axis = "order" | "delivery" | "payment";
export type ActorRole = "customer" | "seller" | "rider" | "admin" | "system";

type Order = Doc<"marketplaceOrders">;

// ---- Transition guards -----------------------------------------------------
// Server is the only source of truth. Each map lists the *only* states a value
// may move to. Anything else (including stage-skipping) is rejected. Admin
// overrides pass `validate: false` deliberately.

export const ORDER_NEXT: Record<string, string[]> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "disputed"],
  ready: ["completed", "disputed"],
  dispatched: ["completed"], // legacy rows
};

export const DELIVERY_NEXT: Record<string, string[]> = {
  unassigned: ["assigned", "rider_accepted"],
  assigned: ["rider_accepted", "unassigned"],
  rider_accepted: ["going_to_seller", "failed"],
  going_to_seller: ["at_seller", "failed"],
  at_seller: ["picked_up", "failed"],
  picked_up: ["on_the_way", "failed"],
  on_the_way: ["near_customer", "delivered", "failed"],
  near_customer: ["delivered", "failed"],
};

export function assertTransition(axis: Axis, from: string, to: string) {
  if (from === to) return;
  const map = axis === "order" ? ORDER_NEXT : DELIVERY_NEXT;
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot move ${axis} from "${from}" to "${to}"`);
  }
}

// ---- ETA estimation (manual-first, no GPS) ---------------------------------
// Pure minute estimates per leg. Documented as estimates — recomputed on every
// status change. GPS distance can later replace the constant legs.
const DEFAULT_PREP_MINS = 20;
const RIDER_TO_SELLER_MINS = 8;
const PICKUP_BUFFER_MINS = 3;
const SELLER_TO_CUSTOMER_MINS = 15;

function minsSince(ts?: number): number {
  if (!ts) return 0;
  return Math.max(0, (Date.now() - ts) / 60000);
}

function prepRemaining(order: Order): number {
  const prep = order.prepTimeMins ?? DEFAULT_PREP_MINS;
  if (!order.preparingAt) return prep;
  return Math.max(0, prep - minsSince(order.preparingAt));
}

/** Remaining minutes until the customer has the food, from the current state. */
function remainingMins(order: Order): number {
  const isDelivery = order.fulfilment === "delivery";
  const lastLeg = isDelivery ? SELLER_TO_CUSTOMER_MINS : 0;
  const d = order.deliveryStatus ?? "unassigned";

  if (order.status === "completed" || d === "delivered") return 0;

  // Rider-driven legs take precedence once a rider is moving.
  switch (d) {
    case "near_customer":
      return 2;
    case "on_the_way":
    case "picked_up":
      return lastLeg;
    case "at_seller":
      return PICKUP_BUFFER_MINS + lastLeg;
    case "going_to_seller":
    case "rider_accepted":
    case "assigned":
      return Math.max(prepRemaining(order), RIDER_TO_SELLER_MINS) + PICKUP_BUFFER_MINS + lastLeg;
  }

  // No rider yet — estimate from the kitchen axis.
  if (order.status === "ready") {
    return isDelivery ? RIDER_TO_SELLER_MINS + PICKUP_BUFFER_MINS + lastLeg : 0;
  }
  if (order.status === "preparing") {
    return prepRemaining(order) + (isDelivery ? RIDER_TO_SELLER_MINS + PICKUP_BUFFER_MINS + lastLeg : 0);
  }
  // pending / accepted
  const prep = order.prepTimeMins ?? DEFAULT_PREP_MINS;
  return prep + (isDelivery ? RIDER_TO_SELLER_MINS + PICKUP_BUFFER_MINS + lastLeg : 0);
}

/** Absolute ETA (ms epoch), or undefined for terminal/non-trackable states. */
export function computeEta(order: Order): number | undefined {
  if (["completed", "cancelled", "rejected"].includes(order.status)) return undefined;
  const remaining = remainingMins(order) + (order.delayMinutes ?? 0);
  return Date.now() + Math.round(remaining) * 60000;
}

// ---- Canonical customer notifications --------------------------------------

type Msg = { kind: string; title: string; body: string } | null;

function fmtClock(ms?: number): string {
  if (!ms) return "shortly";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function customerMessage(
  axis: Axis,
  to: string,
  order: Order,
  riderName?: string
): Msg {
  const shop = order.shopName;
  const eta = fmtClock(order.estimatedArrivalAt);
  if (axis === "order") {
    switch (to) {
      case "accepted":
        return { kind: "order_accepted", title: "Order accepted", body: `${shop} accepted your order and will start cooking shortly.` };
      case "preparing":
        return { kind: "order_preparing", title: "Food is being prepared", body: `${shop} is preparing your food. Estimated prep time: ${order.prepTimeMins ?? DEFAULT_PREP_MINS} minutes.` };
      case "ready":
        return order.fulfilment === "pickup"
          ? { kind: "order_ready", title: "Ready for pickup", body: `Your order at ${shop} is ready. Head over to collect it.` }
          : { kind: "order_ready", title: "Food is ready", body: `Your food from ${shop} is ready and waiting for a rider.` };
      case "rejected":
        return { kind: "order_rejected", title: "Order rejected", body: `${shop} couldn't take your order. Any payment will be refunded.` };
      case "cancelled":
        return { kind: "order_cancelled", title: "Order cancelled", body: `Your order ${order.reference} has been cancelled.` };
      case "completed":
        return { kind: "order_completed", title: "Order completed", body: `Thanks for ordering from ${shop}. Enjoy your meal!` };
      default:
        return null;
    }
  }
  if (axis === "delivery") {
    const who = riderName ? `Your rider ${riderName}` : "Your rider";
    switch (to) {
      case "rider_accepted":
        return { kind: "rider_assigned", title: "Rider assigned", body: `${who} has been assigned and is heading to the restaurant.` };
      case "picked_up":
        return { kind: "rider_picked_up", title: "Order picked up", body: `${who} has picked up your order and should reach you by ${eta}.` };
      case "on_the_way":
        return { kind: "rider_on_the_way", title: "On the way", body: `${who} is on the way to you. ETA ${eta}.` };
      case "near_customer":
        return { kind: "rider_near", title: "Rider is nearby", body: `${who} is nearby — please be ready to receive your order.` };
      case "delivered":
        return { kind: "order_delivered", title: "Delivered", body: `Your order has been delivered. Enjoy!` };
      case "failed":
        return { kind: "delivery_failed", title: "Delivery problem", body: `There was a problem delivering your order. Our team will follow up.` };
      default:
        return null;
    }
  }
  return null;
}

const STAGE_TIMESTAMP: Record<string, keyof Order> = {
  accepted: "acceptedAt",
  preparing: "preparingAt",
  ready: "readyAt",
  picked_up: "pickedUpAt",
  delivered: "deliveredAt",
};

/**
 * THE choke point for status writes. Validates the transition, patches the
 * order (axis field + stage timestamp + recomputed ETA), appends an audit row,
 * and notifies the customer. Returns the patch it applied so callers can chain
 * extra fields atomically via the merged order they already hold.
 */
export async function recordStatusChange(
  ctx: MutationCtx,
  opts: {
    order: Order;
    axis: Axis;
    to: string;
    by: { role: ActorRole; userId?: Id<"users"> };
    note?: string;
    lat?: number;
    lng?: number;
    validate?: boolean;
    notify?: boolean;
    riderName?: string;
    extraPatch?: Record<string, unknown>;
  }
): Promise<void> {
  const { order, axis, to, by } = opts;
  const field = axis === "order" ? "status" : axis === "delivery" ? "deliveryStatus" : "paymentStatus";
  const from = String((order as any)[field] ?? (axis === "delivery" ? "unassigned" : ""));

  if (opts.validate !== false && axis !== "payment") {
    assertTransition(axis, from, to);
  }

  const now = Date.now();
  const patch: Record<string, unknown> = { [field]: to, updatedAt: now, ...(opts.extraPatch ?? {}) };

  const tsField = STAGE_TIMESTAMP[to];
  if (tsField && (order as any)[tsField] === undefined) patch[tsField] = now;

  // Recompute ETA against the post-patch view of the order.
  const merged = { ...order, ...patch } as Order;
  patch.estimatedArrivalAt = computeEta(merged);

  await ctx.db.patch(order._id, patch);

  await ctx.db.insert("orderStatusHistory", {
    orderId: order._id,
    axis,
    oldValue: from || undefined,
    newValue: to,
    changedByRole: by.role,
    changedById: by.userId,
    note: opts.note,
    lat: opts.lat,
    lng: opts.lng,
    createdAt: now,
  });

  if (opts.notify !== false) {
    const msg = customerMessage(axis, to, { ...merged } as Order, opts.riderName);
    if (msg) {
      await dispatch(ctx, {
        userId: order.customerId,
        orderId: order._id,
        kind: msg.kind,
        title: msg.title,
        body: msg.body,
      });
    }
  }
}
