"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ksh } from "@/lib/format";
import Icon from "./Icon";

type Order = Doc<"marketplaceOrders"> & { items: Doc<"marketplaceOrderItems">[] };

/**
 * "Order again" shelf on the home screen — one card per shop from the user's
 * finished orders. Renders nothing while loading or for signed-out users, so
 * the home screen never blocks on it.
 */
export default function OrderAgain() {
  const orders = useQuery(api.marketplaceOrders.myOrders) as Order[] | undefined;
  if (!orders || orders.length === 0) return null;

  const finished = orders.filter(
    (o) => o.status === "completed" || o.deliveryStatus === "delivered"
  );

  // Most recent order per shop, capped at five cards.
  const seen = new Set<string>();
  const picks: Order[] = [];
  for (const o of finished) {
    const key = String(o.shopId ?? o.shopName);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(o);
    if (picks.length === 5) break;
  }
  if (picks.length === 0) return null;

  return (
    <section className="mt-md">
      <div className="flex items-end justify-between px-margin-mobile mb-sm">
        <h2 className="font-headline-md text-on-surface text-[20px]">Order again</h2>
      </div>
      <div className="flex gap-sm overflow-x-auto hide-scrollbar px-margin-mobile pb-1">
        {picks.map((o) => (
          <ReorderCard key={o._id} order={o} />
        ))}
      </div>
    </section>
  );
}

function ReorderCard({ order }: { order: Order }) {
  const router = useRouter();
  const reorder = useMutation(api.cart.reorder);
  const [busy, setBusy] = useState(false);

  const itemCount = order.items.reduce((n, it) => n + it.qty, 0);
  const cover = order.items[0]?.image;

  const run = async () => {
    setBusy(true);
    try {
      await reorder({ orderId: order._id });
      router.push("/cart");
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="w-60 flex-shrink-0 bg-surface rounded-3xl smooth-shadow p-sm flex items-center gap-sm">
      <div
        className="w-14 h-14 rounded-2xl bg-cover bg-center bg-surface-container-high flex-shrink-0"
        style={cover ? { backgroundImage: `url('${cover}')` } : undefined}
      />
      <div className="min-w-0 flex-grow">
        <p className="font-label-md text-on-surface truncate">{order.shopName}</p>
        <p className="font-label-sm text-tertiary text-[11px]">
          {itemCount} item{itemCount === 1 ? "" : "s"} · {ksh(order.total)}
        </p>
      </div>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        aria-label={`Reorder from ${order.shopName}`}
        className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform disabled:opacity-50"
      >
        <Icon
          name={busy ? "progress_activity" : "replay"}
          className={busy ? "text-xl animate-spin" : "text-xl"}
        />
      </button>
    </div>
  );
}
