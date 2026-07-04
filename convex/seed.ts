import { mutation } from "./_generated/server";
import {
  vendors as seedVendors,
  meals as seedMeals,
  orders as seedOrders,
  cartLines as seedCart,
} from "../lib/data";

const toNumber = (price: string) => Number(price.replace(/[^0-9.]/g, "")) || 0;

const tables = ["vendors", "meals", "orders", "cartLines"] as const;

// Idempotent: wipes the four tables and reloads them from lib/data.ts.
// Run with:  npx convex run seed:run
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    }

    for (const vendor of seedVendors) {
      await ctx.db.insert("vendors", vendor);
    }

    for (const meal of seedMeals) {
      await ctx.db.insert("meals", {
        name: meal.name,
        rating: meal.rating,
        price: toNumber(meal.price),
        image: meal.image,
        vendor: meal.vendor,
      });
    }

    for (const order of seedOrders) {
      await ctx.db.insert("orders", {
        reference: order.id,
        vendor: order.vendor,
        placedAt: order.placedAt,
        status: order.status,
        total: order.total,
        image: order.image,
        items: order.items,
        ...(order.eta ? { eta: order.eta } : {}),
      });
    }

    for (const line of seedCart) {
      await ctx.db.insert("cartLines", {
        name: line.name,
        vendor: line.vendor,
        price: line.price,
        qty: line.qty,
        image: line.image,
        ...(line.note ? { note: line.note } : {}),
      });
    }

    return {
      vendors: seedVendors.length,
      meals: seedMeals.length,
      orders: seedOrders.length,
      cartLines: seedCart.length,
    };
  },
});
