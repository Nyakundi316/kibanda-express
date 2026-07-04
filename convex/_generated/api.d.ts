/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminOrders from "../adminOrders.js";
import type * as auth from "../auth.js";
import type * as cart from "../cart.js";
import type * as foodItems from "../foodItems.js";
import type * as http from "../http.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_orderFlow from "../lib/orderFlow.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_sales from "../lib/sales.js";
import type * as marketplace from "../marketplace.js";
import type * as marketplaceOrders from "../marketplaceOrders.js";
import type * as meals from "../meals.js";
import type * as mpesa from "../mpesa.js";
import type * as notifications from "../notifications.js";
import type * as orderTracking from "../orderTracking.js";
import type * as orders from "../orders.js";
import type * as plans from "../plans.js";
import type * as profiles from "../profiles.js";
import type * as riders from "../riders.js";
import type * as seed from "../seed.js";
import type * as seedMarket from "../seedMarket.js";
import type * as sellerDashboard from "../sellerDashboard.js";
import type * as shops from "../shops.js";
import type * as subscriptions from "../subscriptions.js";
import type * as vendors from "../vendors.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminOrders: typeof adminOrders;
  auth: typeof auth;
  cart: typeof cart;
  foodItems: typeof foodItems;
  http: typeof http;
  "lib/notify": typeof lib_notify;
  "lib/orderFlow": typeof lib_orderFlow;
  "lib/phone": typeof lib_phone;
  "lib/rbac": typeof lib_rbac;
  "lib/sales": typeof lib_sales;
  marketplace: typeof marketplace;
  marketplaceOrders: typeof marketplaceOrders;
  meals: typeof meals;
  mpesa: typeof mpesa;
  notifications: typeof notifications;
  orderTracking: typeof orderTracking;
  orders: typeof orders;
  plans: typeof plans;
  profiles: typeof profiles;
  riders: typeof riders;
  seed: typeof seed;
  seedMarket: typeof seedMarket;
  sellerDashboard: typeof sellerDashboard;
  shops: typeof shops;
  subscriptions: typeof subscriptions;
  vendors: typeof vendors;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
