import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) =>
    ctx.db.query("orders").order("desc").collect(),
});

export const byStatus = query({
  args: {
    status: v.union(
      v.literal("preparing"),
      v.literal("on-the-way"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, { status }) =>
    ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", status))
      .collect(),
});
