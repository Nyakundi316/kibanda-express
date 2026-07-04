import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// Reusable validators ------------------------------------------------------
export const roleValidator = v.union(
  v.literal("customer"),
  v.literal("seller"),
  v.literal("rider"),
  v.literal("admin")
);

export const availabilityValidator = v.union(
  v.literal("available"),
  v.literal("unavailable"),
  v.literal("sold_out")
);

export const foodStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived")
);

export const subStatusValidator = v.union(
  v.literal("pending"), // payment initiated, not yet confirmed
  v.literal("active"),
  v.literal("expired"),
  v.literal("cancelled")
);

export const paymentStatusValidator = v.union(
  v.literal("pending"), // STK push sent, awaiting callback
  v.literal("unconfigured"), // Daraja creds missing — cannot be confirmed
  v.literal("success"),
  v.literal("failed")
);

// Customer order lifecycle (the "kitchen" axis). Delivery progress lives on a
// separate `deliveryStatus` axis, payment on `paymentStatus` — never merged.
export const orderStatusValidator = v.union(
  v.literal("pending"), // placed, awaiting seller
  v.literal("accepted"),
  v.literal("preparing"),
  v.literal("ready"),
  v.literal("dispatched"), // legacy: kept valid for old rows / pre-rider flow
  v.literal("completed"),
  v.literal("cancelled"), // by customer
  v.literal("rejected"), // by seller
  v.literal("disputed") // a problem was reported, awaiting resolution
);

// Order payment axis. Kept independent from order/delivery status.
export const orderPaymentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("refunded")
);

// Rider/delivery axis. Only meaningful for `fulfilment === "delivery"`.
export const deliveryStatusValidator = v.union(
  v.literal("unassigned"), // no rider yet
  v.literal("assigned"), // offered to a rider, not yet accepted
  v.literal("rider_accepted"), // rider took the job
  v.literal("going_to_seller"),
  v.literal("at_seller"),
  v.literal("picked_up"),
  v.literal("on_the_way"),
  v.literal("near_customer"),
  v.literal("delivered"),
  v.literal("failed")
);

export default defineSchema({
  // ---- Convex Auth (users, sessions, accounts, etc.) ----
  ...authTables,

  // ---- Existing customer-facing tables (unchanged) ----
  vendors: defineTable({
    name: v.string(),
    rating: v.string(),
    time: v.string(),
    delivery: v.string(),
    image: v.string(),
  }),

  meals: defineTable({
    name: v.string(),
    rating: v.string(),
    price: v.number(),
    image: v.string(),
    vendor: v.optional(v.string()),
  }),

  orders: defineTable({
    reference: v.string(),
    vendor: v.string(),
    placedAt: v.string(),
    status: v.union(
      v.literal("preparing"),
      v.literal("on-the-way"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    total: v.number(),
    eta: v.optional(v.string()),
    image: v.string(),
    items: v.array(v.object({ name: v.string(), qty: v.number() })),
  }).index("by_status", ["status"]),

  cartLines: defineTable({
    name: v.string(),
    vendor: v.string(),
    price: v.number(),
    qty: v.number(),
    image: v.string(),
    note: v.optional(v.string()),
    // Marketplace fields (added). Legacy demo lines leave these unset.
    userId: v.optional(v.id("users")),
    foodId: v.optional(v.id("foodItems")),
    shopId: v.optional(v.id("shops")),
    sellerId: v.optional(v.id("users")),
  }).index("by_user", ["userId"]),

  // ---- Marketplace: identity & roles ----
  // Role lives here, written only by server code — never by the auth provider.
  profiles: defineTable({
    userId: v.id("users"),
    role: roleValidator,
    displayName: v.optional(v.string()),
    phone: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Seller verification / business details (KYC-lite).
  sellerProfiles: defineTable({
    userId: v.id("users"),
    businessName: v.string(),
    ownerName: v.string(),
    phone: v.string(),
    whatsapp: v.optional(v.string()),
    location: v.string(),
    idNumber: v.optional(v.string()), // ID/passport, optional
    verification: v.union(
      v.literal("unverified"),
      v.literal("pending"),
      v.literal("verified"),
      v.literal("rejected")
    ),
    accountStatus: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("banned")
    ),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // ---- Subscriptions & payments ----
  subscriptionPlans: defineTable({
    key: v.string(), // "daily" | "monthly" | "premium"
    name: v.string(),
    price: v.number(), // KSh, server-authoritative
    durationDays: v.number(),
    maxListings: v.number(),
    premium: v.boolean(),
    features: v.array(v.string()),
    active: v.boolean(),
  }).index("by_key", ["key"]),

  sellerSubscriptions: defineTable({
    sellerId: v.id("users"),
    planKey: v.string(),
    status: subStatusValidator,
    paymentId: v.optional(v.id("payments")),
    startsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_seller", ["sellerId"])
    .index("by_status", ["status"]),

  // One row per payment attempt. Status is mutated ONLY by the verified
  // Daraja callback (or marked unconfigured when creds are absent).
  payments: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("subscription"), v.literal("order")),
    amount: v.number(),
    currency: v.string(), // "KES"
    status: paymentStatusValidator,
    provider: v.string(), // "mpesa"
    phone: v.optional(v.string()),
    planKey: v.optional(v.string()),
    subscriptionId: v.optional(v.id("sellerSubscriptions")),
    orderId: v.optional(v.id("marketplaceOrders")),
    merchantRequestId: v.optional(v.string()),
    checkoutRequestId: v.optional(v.string()),
    mpesaReceipt: v.optional(v.string()),
    resultCode: v.optional(v.number()),
    resultDesc: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_checkout", ["checkoutRequestId"]),

  // ---- Shops & food ----
  shops: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    logo: v.optional(v.string()),
    banner: v.optional(v.string()),
    location: v.string(),
    phone: v.string(),
    whatsapp: v.optional(v.string()),
    openHour: v.optional(v.string()),
    closeHour: v.optional(v.string()),
    fulfilment: v.array(v.string()), // ["delivery","pickup"]
    categories: v.array(v.string()),
    active: v.boolean(),
    featured: v.boolean(),
    ratingAvg: v.number(),
    ratingCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_active", ["active"]),

  foodItems: defineTable({
    shopId: v.id("shops"),
    sellerId: v.id("users"),
    name: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    price: v.number(),
    quantity: v.number(),
    prepTimeMins: v.optional(v.number()),
    image: v.optional(v.string()),
    availability: availabilityValidator,
    status: foodStatusValidator,
    boosted: v.boolean(),
    soldCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_shop", ["shopId"])
    .index("by_seller", ["sellerId"]),

  foodImages: defineTable({
    foodId: v.id("foodItems"),
    sellerId: v.id("users"),
    url: v.string(),
    createdAt: v.number(),
  }).index("by_food", ["foodId"]),

  // ---- Sales tracking (one row per sold line, powers the dashboard) ----
  sellerSales: defineTable({
    sellerId: v.id("users"),
    shopId: v.id("shops"),
    foodId: v.id("foodItems"),
    foodName: v.string(),
    qty: v.number(),
    unitPrice: v.number(),
    revenue: v.number(),
    paymentStatus: v.union(v.literal("pending"), v.literal("completed")),
    createdAt: v.number(),
  }).index("by_seller", ["sellerId"]),

  // ---- Customer orders (the real pipeline) ----
  // One order per shop. A multi-shop cart fans out into several orders.
  marketplaceOrders: defineTable({
    reference: v.string(), // human id e.g. "KE-7F3A"
    customerId: v.id("users"),
    shopId: v.optional(v.id("shops")),
    sellerId: v.optional(v.id("users")),
    shopName: v.string(),
    status: orderStatusValidator,
    fulfilment: v.string(), // "delivery" | "pickup"
    customerName: v.string(),
    customerPhone: v.string(),
    address: v.optional(v.string()),
    note: v.optional(v.string()),
    subtotal: v.number(),
    deliveryFee: v.number(),
    serviceFee: v.number(),
    total: v.number(),
    paymentMethod: v.string(), // "mpesa" | "cash"
    paymentStatus: orderPaymentStatusValidator,
    paymentId: v.optional(v.id("payments")),
    salesRecorded: v.boolean(), // guards idempotent sellerSales writes

    // ---- Delivery / tracking (all optional; legacy rows simply omit them) ----
    deliveryStatus: v.optional(deliveryStatusValidator),
    riderId: v.optional(v.id("users")),
    prepTimeMins: v.optional(v.number()), // seller's estimate, drives ETA
    // Stage timestamps — power the timeline + ETA maths.
    acceptedAt: v.optional(v.number()),
    preparingAt: v.optional(v.number()),
    readyAt: v.optional(v.number()),
    pickedUpAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    estimatedArrivalAt: v.optional(v.number()), // ms epoch, recomputed on changes
    delayMinutes: v.optional(v.number()),
    delayReason: v.optional(v.string()),
    disputeId: v.optional(v.id("orderDisputes")),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_seller", ["sellerId"])
    .index("by_shop", ["shopId"])
    .index("by_rider", ["riderId"])
    .index("by_delivery_status", ["deliveryStatus"]),

  marketplaceOrderItems: defineTable({
    orderId: v.id("marketplaceOrders"),
    foodId: v.optional(v.id("foodItems")),
    name: v.string(),
    image: v.string(),
    unitPrice: v.number(),
    qty: v.number(),
    lineTotal: v.number(),
  }).index("by_order", ["orderId"]),

  // ---- Riders & delivery tracking ----
  // Rider identity/KYC. Role on `profiles` only flips to "rider" once an admin
  // approves this row (verification === "approved").
  riderProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    phone: v.string(),
    vehicleType: v.union(
      v.literal("motorbike"),
      v.literal("bicycle"),
      v.literal("car"),
      v.literal("on_foot")
    ),
    vehiclePlate: v.optional(v.string()),
    verification: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    accountStatus: v.union(v.literal("active"), v.literal("suspended")),
    availability: v.union(v.literal("online"), v.literal("offline")),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // One row per (order, rider) offer. An order has at most one accepted row.
  riderAssignments: defineTable({
    orderId: v.id("marketplaceOrders"),
    riderId: v.id("users"),
    status: v.union(
      v.literal("offered"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("cancelled"),
      v.literal("completed")
    ),
    offeredBy: v.union(v.literal("admin"), v.literal("self")),
    offeredAt: v.number(),
    respondedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_order", ["orderId"])
    .index("by_rider", ["riderId"]),

  // GPS-ready store. NOT written this phase (manual-first). The query layer
  // refuses to return a location once the order is terminal (privacy rule).
  riderLocations: defineTable({
    riderId: v.id("users"),
    orderId: v.id("marketplaceOrders"),
    lat: v.number(),
    lng: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_rider", ["riderId"]),

  // Full audit of every status change across all three axes.
  orderStatusHistory: defineTable({
    orderId: v.id("marketplaceOrders"),
    axis: v.union(
      v.literal("payment"),
      v.literal("order"),
      v.literal("delivery")
    ),
    oldValue: v.optional(v.string()),
    newValue: v.string(),
    changedByRole: v.union(
      v.literal("customer"),
      v.literal("seller"),
      v.literal("rider"),
      v.literal("admin"),
      v.literal("system")
    ),
    changedById: v.optional(v.id("users")),
    note: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_order", ["orderId"]),

  // In-app notification feed (real, live). External channels are dispatched
  // from the same hook but are stubbed for now.
  orderNotifications: defineTable({
    userId: v.id("users"),
    orderId: v.optional(v.id("marketplaceOrders")),
    kind: v.string(), // e.g. "order_accepted", "rider_assigned", "delayed"
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  orderDisputes: defineTable({
    orderId: v.id("marketplaceOrders"),
    raisedById: v.id("users"),
    raisedByRole: roleValidator,
    reason: v.string(),
    details: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("reviewing"),
      v.literal("resolved")
    ),
    resolution: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_order", ["orderId"]),

  // Manual refund workflow. No automated M-Pesa reversal — an admin records and
  // marks the refund processed out-of-band.
  refunds: defineTable({
    orderId: v.id("marketplaceOrders"),
    paymentId: v.optional(v.id("payments")),
    amount: v.number(),
    reason: v.string(),
    status: v.union(
      v.literal("requested"),
      v.literal("approved"),
      v.literal("processed"),
      v.literal("rejected")
    ),
    requestedById: v.id("users"),
    processedById: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_order", ["orderId"]),

  // ---- Reviews, reports, admin audit ----
  reviews: defineTable({
    shopId: v.id("shops"),
    customerId: v.id("users"),
    rating: v.number(),
    comment: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_shop", ["shopId"]),

  reports: defineTable({
    reporterId: v.id("users"),
    targetType: v.union(
      v.literal("shop"),
      v.literal("food"),
      v.literal("seller")
    ),
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("reviewing"),
      v.literal("resolved")
    ),
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  adminActions: defineTable({
    adminId: v.id("users"),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }),
});
