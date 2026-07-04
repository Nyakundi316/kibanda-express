import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Records the per-line sales for a completed order and updates stock. Shared by
 * the seller order flow (updateStatus → completed) so the dashboard's numbers
 * come from exactly one code path. Idempotent at the caller via
 * `order.salesRecorded`; returns true if it wrote anything.
 */
export async function recordSalesForOrder(
  ctx: MutationCtx,
  order: Doc<"marketplaceOrders">
): Promise<boolean> {
  if (order.salesRecorded || !order.sellerId || !order.shopId) return false;

  const items = await ctx.db
    .query("marketplaceOrderItems")
    .withIndex("by_order", (q) => q.eq("orderId", order._id))
    .collect();

  for (const it of items) {
    await ctx.db.insert("sellerSales", {
      sellerId: order.sellerId,
      shopId: order.shopId,
      foodId: it.foodId!,
      foodName: it.name,
      qty: it.qty,
      unitPrice: it.unitPrice,
      revenue: it.lineTotal,
      paymentStatus: "completed",
      createdAt: Date.now(),
    });
    if (it.foodId) {
      const food = await ctx.db.get(it.foodId);
      if (food) {
        const remaining = Math.max(0, food.quantity - it.qty);
        await ctx.db.patch(it.foodId, {
          soldCount: food.soldCount + it.qty,
          quantity: remaining,
          ...(remaining === 0 ? { availability: "sold_out" as const } : {}),
        });
      }
    }
  }
  return true;
}
