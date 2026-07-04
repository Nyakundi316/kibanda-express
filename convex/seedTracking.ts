import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Dev helper for the live tracking map. Puts an existing order into an active
 * delivery with a demo rider and a GPS fix near Nairobi CBD, so the customer's
 * map can be exercised without onboarding a real rider account.
 *
 *   npx convex run seedTracking:start '{"reference":"KE-XXXX"}'
 *   npx convex run seedTracking:move '{"reference":"KE-XXXX"}'   # nudge north-east
 */
export const start = internalMutation({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) => {
    const order = await ctx.db
      .query("marketplaceOrders")
      .filter((q) => q.eq(q.field("reference"), reference))
      .first();
    if (!order) throw new Error(`No order with reference ${reference}`);

    // Demo rider — reused across runs.
    let rider = await ctx.db
      .query("riderProfiles")
      .filter((q) => q.eq(q.field("name"), "Demo Rider (seed)"))
      .first();
    let riderId = rider?.userId;
    if (!riderId) {
      riderId = await ctx.db.insert("users", {
        email: "demo-rider@seed.local",
        name: "Demo Rider (seed)",
      });
      await ctx.db.insert("riderProfiles", {
        userId: riderId,
        name: "Demo Rider (seed)",
        phone: "254700000000",
        vehicleType: "motorbike",
        vehiclePlate: "KMDB 123X",
        verification: "approved",
        accountStatus: "active",
        availability: "online",
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch(order._id, {
      riderId,
      deliveryStatus: "on_the_way",
      status: "ready",
      updatedAt: Date.now(),
    });

    // First fix: Kencom, Nairobi CBD.
    const existing = await ctx.db
      .query("riderLocations")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lat: -1.2864, lng: 36.8172, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("riderLocations", {
        riderId,
        orderId: order._id,
        lat: -1.2864,
        lng: 36.8172,
        updatedAt: Date.now(),
      });
    }
    return { orderId: order._id, riderId };
  },
});

export const move = internalMutation({
  args: { reference: v.string() },
  handler: async (ctx, { reference }) => {
    const order = await ctx.db
      .query("marketplaceOrders")
      .filter((q) => q.eq(q.field("reference"), reference))
      .first();
    if (!order) throw new Error(`No order with reference ${reference}`);
    const loc = await ctx.db
      .query("riderLocations")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .first();
    if (!loc) throw new Error("Run seedTracking:start first");
    // ~150m hop toward Westlands.
    await ctx.db.patch(loc._id, {
      lat: loc.lat + 0.0011,
      lng: loc.lng + 0.0008,
      updatedAt: Date.now(),
    });
    return { lat: loc.lat + 0.0011, lng: loc.lng + 0.0008 };
  },
});
