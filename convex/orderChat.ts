import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth, getProfile } from "./lib/rbac";
import { dispatch } from "./lib/notify";

// Chat stays open while the order is live and for a short grace period after
// it closes, so "where did you leave it?" conversations can still finish.
const CLOSED = ["completed", "cancelled", "rejected"];
const GRACE_MS = 24 * 60 * 60 * 1000;

type PartyRole = "customer" | "seller" | "rider" | "admin";

/** Which side of this order is the caller on? null = no business reading it. */
async function partyRole(
  ctx: QueryCtx,
  order: Doc<"marketplaceOrders">,
  userId: Id<"users">
): Promise<PartyRole | null> {
  if (order.customerId === userId) return "customer";
  if (order.sellerId === userId) return "seller";
  if (order.riderId === userId) return "rider";
  const profile = await getProfile(ctx);
  return profile?.role === "admin" ? "admin" : null;
}

async function riderName(ctx: QueryCtx, riderId?: Id<"users"> | null) {
  if (!riderId) return "Rider";
  const rp = await ctx.db
    .query("riderProfiles")
    .withIndex("by_user", (q) => q.eq("userId", riderId))
    .unique();
  return rp?.name ?? "Rider";
}

export const list = query({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const orderId = ctx.db.normalizeId("marketplaceOrders", args.orderId);
    if (!orderId) return null;
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const me = await partyRole(ctx, order, userId);
    if (!me) return null;

    const messages = await ctx.db
      .query("orderMessages")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    messages.sort((a, b) => a.createdAt - b.createdAt);

    const names: Record<PartyRole, string> = {
      customer: order.customerName,
      seller: order.shopName,
      rider: await riderName(ctx, order.riderId),
      admin: "Support",
    };

    const closedAt = CLOSED.includes(order.status) ? order.updatedAt : null;
    return {
      me,
      open: !closedAt || Date.now() - closedAt < GRACE_MS,
      messages: messages.map((m) => ({
        _id: m._id,
        body: m.body,
        createdAt: m.createdAt,
        senderRole: m.senderRole,
        senderName: names[m.senderRole],
        mine: m.senderId === userId,
      })),
    };
  },
});

export const send = mutation({
  args: { orderId: v.id("marketplaceOrders"), body: v.string() },
  handler: async (ctx, { orderId, body }) => {
    const userId = await requireAuth(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");
    const role = await partyRole(ctx, order, userId);
    if (!role) throw new Error("Order not found");

    const text = body.trim();
    if (!text) throw new Error("Message is empty");
    if (text.length > 500) throw new Error("Keep messages under 500 characters");
    if (
      CLOSED.includes(order.status) &&
      Date.now() - order.updatedAt >= GRACE_MS
    )
      throw new Error("Chat is closed for this order");

    await ctx.db.insert("orderMessages", {
      orderId,
      senderId: userId,
      senderRole: role,
      body: text,
      createdAt: Date.now(),
    });

    // Ping the other parties in-app. The rider only cares while delivering.
    const senderName =
      role === "customer"
        ? order.customerName
        : role === "seller"
        ? order.shopName
        : role === "rider"
        ? await riderName(ctx, order.riderId)
        : "Support";
    const preview = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    const recipients: Array<Id<"users"> | undefined> = [
      role !== "customer" ? order.customerId : undefined,
      role !== "seller" ? order.sellerId ?? undefined : undefined,
      role !== "rider" &&
      order.deliveryStatus &&
      !["delivered", "failed"].includes(order.deliveryStatus)
        ? order.riderId ?? undefined
        : undefined,
    ];
    for (const to of recipients) {
      if (!to) continue;
      await dispatch(ctx, {
        userId: to,
        orderId,
        kind: "chat_message",
        title: `New message · ${order.reference}`,
        body: `${senderName}: ${preview}`,
      });
    }
  },
});
