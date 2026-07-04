import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/rbac";

/** The signed-in user's notifications, newest first (capped). */
export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("orderNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(40);
    return rows;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;
    const rows = await ctx.db
      .query("orderNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter((r) => !r.read).length;
  },
});

export const markRead = mutation({
  args: { id: v.id("orderNotifications") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) return;
    if (!row.read) await ctx.db.patch(id, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const rows = await ctx.db
      .query("orderNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(
      rows.filter((r) => !r.read).map((r) => ctx.db.patch(r._id, { read: true }))
    );
  },
});
