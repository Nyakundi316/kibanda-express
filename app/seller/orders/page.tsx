"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { ksh } from "@/lib/format";
import { humanize } from "@/lib/errors";
import Icon from "@/components/Icon";
import OrderChat from "@/components/OrderChat";

type Order = FunctionReturnType<typeof api.marketplaceOrders.forSeller>[number];

// Kitchen-axis actions the seller drives. Delivery completion is the rider's job.
const ACTIONS: Record<string, { status: string; label: string; icon: string; tone?: "bad" }[]> = {
  pending: [
    { status: "accepted", label: "Accept", icon: "check" },
    { status: "rejected", label: "Reject", icon: "close", tone: "bad" },
  ],
  accepted: [{ status: "preparing", label: "Start preparing", icon: "skillet" }],
  preparing: [{ status: "ready", label: "Mark ready", icon: "takeout_dining" }],
};

const TABS = ["Active", "Completed"] as const;

const DELIVERY_LABEL: Record<string, string> = {
  unassigned: "Waiting for a rider",
  assigned: "Rider offered — awaiting accept",
  rider_accepted: "Rider on the way to you",
  going_to_seller: "Rider on the way to you",
  at_seller: "Rider is here for pickup",
  picked_up: "Picked up",
  on_the_way: "Out for delivery",
  near_customer: "Near customer",
  delivered: "Delivered",
  failed: "Delivery failed",
};

export default function SellerOrdersPage() {
  const orders = useQuery(api.marketplaceOrders.forSeller);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Active");

  return (
    <main className="min-h-screen">
      <header className="px-margin-mobile pt-base pb-sm">
        <h1 className="font-headline-md text-on-surface text-[24px]">Orders</h1>
        <p className="text-tertiary font-label-sm">Manage incoming orders</p>
      </header>

      <div className="px-margin-mobile">
        <div className="flex gap-1 bg-surface-container-low p-1 rounded-full">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-full font-label-md transition-colors ${
                tab === t ? "bg-surface text-primary shadow-sm" : "text-tertiary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {orders === undefined ? (
        <div className="px-margin-mobile mt-md flex flex-col gap-sm">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 rounded-3xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
      ) : (
        (() => {
          const active = orders.filter((o) => !["completed", "cancelled", "rejected"].includes(o.status));
          const done = orders.filter((o) => ["completed", "cancelled", "rejected"].includes(o.status));
          const list = tab === "Active" ? active : done;
          if (list.length === 0)
            return <p className="text-tertiary text-center py-lg">No {tab.toLowerCase()} orders.</p>;
          return (
            <section className="px-margin-mobile mt-md flex flex-col gap-sm">
              {list.map((o) => (
                <SellerOrderCard key={o._id} order={o} />
              ))}
            </section>
          );
        })()
      )}
    </main>
  );
}

function SellerOrderCard({ order }: { order: Order }) {
  const update = useMutation(api.marketplaceOrders.updateStatus);
  const setPrepTime = useMutation(api.marketplaceOrders.setPrepTime);
  const reportDelay = useMutation(api.riders.reportDelay);
  const delayReasons = useQuery(api.riders.delayReasons) ?? [];

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState(String(order.prepTimeMins ?? ""));
  const [showDelay, setShowDelay] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const actions = ACTIONS[order.status] ?? [];
  const isDelivery = order.fulfilment === "delivery";
  const canSetPrep = ["pending", "accepted", "preparing"].includes(order.status);
  // Pickup orders are handed over by the seller; delivery completes via rider.
  const showPickupComplete = !isDelivery && order.status === "ready";

  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(humanize(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="bg-surface rounded-3xl smooth-shadow p-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-label-md text-on-surface">{order.reference}</p>
          <p className="font-label-sm text-tertiary capitalize">
            {order.status} · {order.fulfilment}
          </p>
        </div>
        <span className="font-headline-md text-primary text-[18px] tabular-nums">{ksh(order.total)}</span>
      </div>

      <ul className="mt-sm text-on-surface-variant font-label-sm">
        {order.items.map((it) => (
          <li key={it._id} className="flex justify-between">
            <span className="truncate">{it.qty}× {it.name}</span>
            <span className="tabular-nums">{ksh(it.lineTotal)}</span>
          </li>
        ))}
      </ul>

      {/* Customer contact */}
      <div className="mt-sm bg-surface-container-low rounded-2xl p-sm text-on-surface-variant font-label-sm">
        <p className="flex items-center gap-1"><Icon name="person" className="text-base" /> {order.customerName}</p>
        <a href={`tel:${order.customerPhone}`} className="flex items-center gap-1 text-primary">
          <Icon name="call" className="text-base" /> {order.customerPhone}
        </a>
        {order.address ? (
          <p className="flex items-center gap-1"><Icon name="location_on" className="text-base" /> {order.address}</p>
        ) : null}
        {order.note ? (
          <p className="italic flex items-center gap-1"><Icon name="sticky_note_2" className="text-base" /> “{order.note}”</p>
        ) : null}
        <p className={`flex items-center gap-1 ${order.paymentStatus === "paid" ? "text-secondary" : "text-tertiary"}`}>
          <Icon name={order.paymentStatus === "paid" ? "check_circle" : "schedule"} className="text-base" />
          {order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "refunded" ? "Refunded" : `${order.paymentMethod} · unpaid`}
        </p>
      </div>

      {/* Chat with the customer (and rider once assigned) */}
      <button
        type="button"
        onClick={() => setShowChat((s) => !s)}
        className="mt-sm w-full flex items-center justify-center gap-1 border border-outline-variant text-on-surface-variant font-label-sm py-2 rounded-full"
      >
        <Icon name={showChat ? "expand_less" : "chat"} className="text-base" />
        {showChat ? "Hide chat" : "Chat with customer"}
      </button>
      {showChat ? (
        <div className="mt-sm bg-surface-container-low rounded-2xl p-sm">
          <OrderChat orderId={order._id} />
        </div>
      ) : null}

      {/* Prep time */}
      {canSetPrep ? (
        <div className="mt-sm flex items-center gap-2">
          <label className="flex-grow flex items-center gap-2 bg-surface-container-low rounded-2xl px-3 py-2">
            <Icon name="timer" className="text-tertiary text-lg" />
            <span className="font-label-sm text-tertiary">Prep mins</span>
            <input
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
              inputMode="numeric"
              placeholder="20"
              className="w-16 bg-transparent text-on-surface focus:outline-none tabular-nums"
            />
          </label>
          <button
            type="button"
            disabled={busy || !prep}
            onClick={run(() => setPrepTime({ orderId: order._id, minutes: Number(prep) || 0 }))}
            className="px-4 py-2 rounded-2xl bg-primary text-on-primary font-label-sm disabled:opacity-50"
          >
            Save
          </button>
        </div>
      ) : null}

      {/* Assigned rider (delivery only) */}
      {isDelivery && order.status === "ready" ? (
        <div className="mt-sm bg-secondary-container/40 rounded-2xl p-sm">
          {order.rider ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-label-sm text-on-surface flex items-center gap-1">
                  <Icon name="sports_motorsports" className="text-base" /> {order.rider.name}
                </p>
                <p className="font-label-sm text-tertiary">{DELIVERY_LABEL[order.deliveryStatus ?? "unassigned"]}</p>
              </div>
              <a href={`tel:${order.rider.phone}`} className="flex items-center gap-1 text-primary font-label-sm">
                <Icon name="call" className="text-base" /> Call rider
              </a>
            </div>
          ) : (
            <p className="font-label-sm text-tertiary flex items-center gap-1">
              <Icon name="schedule" className="text-base" /> {DELIVERY_LABEL[order.deliveryStatus ?? "unassigned"]}
            </p>
          )}
        </div>
      ) : null}

      {/* Kitchen actions */}
      {actions.length ? (
        <div className="flex gap-2 mt-sm">
          {actions.map((a) => (
            <button
              key={a.status}
              type="button"
              disabled={busy}
              onClick={run(() => update({ orderId: order._id, status: a.status as Order["status"] }))}
              className={`flex-1 py-2.5 rounded-full font-label-md flex items-center justify-center gap-1 disabled:opacity-50 ${
                a.tone === "bad" ? "bg-error-container text-on-error-container" : "bg-primary text-on-primary"
              }`}
            >
              <Icon name={a.icon} className="text-lg" /> {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {showPickupComplete ? (
        <button
          type="button"
          disabled={busy}
          onClick={run(() => update({ orderId: order._id, status: "completed" }))}
          className="mt-sm w-full py-2.5 rounded-full bg-secondary text-on-secondary font-label-md flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Icon name="check_circle" className="text-lg" /> Handed over to customer
        </button>
      ) : null}

      {/* Delay */}
      {["accepted", "preparing", "ready"].includes(order.status) ? (
        showDelay ? (
          <div className="mt-sm flex flex-wrap gap-2">
            {delayReasons.map((r) => (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={run(async () => {
                  await reportDelay({ orderId: order._id, minutes: 10, reason: r });
                  setShowDelay(false);
                })}
                className="px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm"
              >
                {r}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => setShowDelay(true)} className="mt-2 w-full text-tertiary font-label-sm py-1 flex items-center justify-center gap-1">
            <Icon name="schedule" className="text-base" /> Report a delay
          </button>
        )
      ) : null}

      {err ? <p className="text-error font-label-sm mt-1">{err}</p> : null}
    </article>
  );
}
