"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { ksh } from "@/lib/format";
import { humanize } from "@/lib/errors";
import Icon from "@/components/Icon";

const TABS = ["Available", "Active", "Done"] as const;

type StageFn =
  | "goingToSeller"
  | "arrivedAtSeller"
  | "pickedUp"
  | "onTheWay"
  | "nearCustomer"
  | "markDelivered";

// deliveryStatus → the single next action a rider takes from that stage.
const NEXT_ACTION: Record<string, { label: string; icon: string; fn: StageFn }> = {
  rider_accepted: { label: "Start — heading to seller", icon: "directions_bike", fn: "goingToSeller" },
  going_to_seller: { label: "Arrived at seller", icon: "storefront", fn: "arrivedAtSeller" },
  at_seller: { label: "Picked up order", icon: "takeout_dining", fn: "pickedUp" },
  picked_up: { label: "On the way to customer", icon: "local_shipping", fn: "onTheWay" },
  on_the_way: { label: "Arrived at customer", icon: "location_on", fn: "nearCustomer" },
  near_customer: { label: "Mark delivered", icon: "check_circle", fn: "markDelivered" },
};

const ACTIVE = ["assigned", "rider_accepted", "going_to_seller", "at_seller", "picked_up", "on_the_way", "near_customer"];

export default function RiderDashboard() {
  const me = useQuery(api.riders.myRiderProfile);
  const available = useQuery(api.riders.availableDeliveries);
  const mine = useQuery(api.riders.myDeliveries);
  const setAvailability = useMutation(api.riders.setAvailability);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Available");

  const active = (mine ?? []).filter((o) => o.deliveryStatus && ACTIVE.includes(o.deliveryStatus));
  const done = (mine ?? []).filter((o) => o.deliveryStatus === "delivered" || o.status === "completed");
  const list = tab === "Available" ? available ?? [] : tab === "Active" ? active : done;

  return (
    <main className="min-h-screen">
      <header className="px-margin-mobile pt-base pb-sm flex items-center justify-between">
        <div>
          <p className="font-label-sm text-tertiary uppercase tracking-wider">Rider</p>
          <h1 className="font-headline-md text-on-surface text-[24px]">Deliveries</h1>
        </div>
        {me ? (
          <button
            type="button"
            onClick={() => setAvailability({ availability: me.availability === "online" ? "offline" : "online" })}
            className={`flex items-center gap-1 font-label-sm px-3 py-1.5 rounded-full ${
              me.availability === "online"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container-high text-tertiary"
            }`}
          >
            <Icon name={me.availability === "online" ? "toggle_on" : "toggle_off"} className="text-xl" />
            {me.availability === "online" ? "Online" : "Offline"}
          </button>
        ) : null}
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
              {t === "Active" && active.length ? ` (${active.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="px-margin-mobile mt-lg text-tertiary text-center">
          {tab === "Available" ? "No open deliveries right now." : tab === "Active" ? "No active deliveries." : "No completed deliveries yet."}
        </p>
      ) : (
        <section className="px-margin-mobile mt-md flex flex-col gap-sm">
          {list.map((o) => (
            <DeliveryCard key={o._id} order={o} pool={tab === "Available"} />
          ))}
        </section>
      )}
    </main>
  );
}

type DeliveryOrder = FunctionReturnType<typeof api.riders.myDeliveries>[number];

function DeliveryCard({ order, pool }: { order: DeliveryOrder; pool: boolean }) {
  const claim = useMutation(api.riders.claimDelivery);
  const respond = useMutation(api.riders.respondToOffer);
  const stageFns = {
    goingToSeller: useMutation(api.riders.goingToSeller),
    arrivedAtSeller: useMutation(api.riders.arrivedAtSeller),
    pickedUp: useMutation(api.riders.pickedUp),
    onTheWay: useMutation(api.riders.onTheWay),
    nearCustomer: useMutation(api.riders.nearCustomer),
    markDelivered: useMutation(api.riders.markDelivered),
  };
  const reportDelay = useMutation(api.riders.reportDelay);
  const reasons = useQuery(api.riders.delayReasons) ?? [];

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showDelay, setShowDelay] = useState(false);

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

  const d = order.deliveryStatus ?? "unassigned";
  const next = NEXT_ACTION[d];
  const mapsTo = (q?: string | null) =>
    q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : undefined;

  return (
    <article className="bg-surface rounded-3xl smooth-shadow p-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-label-md text-on-surface">{order.shopName}</p>
          <p className="font-label-sm text-tertiary">{order.reference} · {order.items.length} item{order.items.length === 1 ? "" : "s"}</p>
        </div>
        <span className="font-headline-md text-primary text-[18px] tabular-nums">{ksh(order.total)}</span>
      </div>

      {/* Pickup + dropoff */}
      <div className="mt-sm flex flex-col gap-2">
        <Leg icon="storefront" label="Pickup" value={order.sellerLocation ?? order.shopName} href={mapsTo(order.sellerLocation)} />
        <Leg icon="location_on" label="Dropoff" value={order.address ?? "—"} href={mapsTo(order.address)} />
      </div>

      {/* Contacts (only on accepted deliveries) */}
      {!pool ? (
        <div className="mt-sm flex gap-2">
          {order.customerPhone ? (
            <a href={`tel:${order.customerPhone}`} className="flex-1 flex items-center justify-center gap-1 border border-primary text-primary font-label-sm py-2 rounded-full">
              <Icon name="call" className="text-base" /> Customer
            </a>
          ) : null}
          {order.sellerPhone ? (
            <a href={`tel:${order.sellerPhone}`} className="flex-1 flex items-center justify-center gap-1 border border-outline-variant text-on-surface-variant font-label-sm py-2 rounded-full">
              <Icon name="call" className="text-base" /> Seller
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Primary action */}
      <div className="mt-sm">
        {pool ? (
          <button
            type="button"
            disabled={busy}
            onClick={run(() => claim({ orderId: order._id }))}
            className="w-full bg-primary text-on-primary font-label-md py-2.5 rounded-full flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Icon name="add_task" className="text-lg" /> Accept delivery
          </button>
        ) : d === "assigned" ? (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={run(() => respond({ orderId: order._id, accept: false }))} className="flex-1 border border-error text-error font-label-md py-2.5 rounded-full disabled:opacity-50">
              Reject
            </button>
            <button type="button" disabled={busy} onClick={run(() => respond({ orderId: order._id, accept: true }))} className="flex-1 bg-primary text-on-primary font-label-md py-2.5 rounded-full disabled:opacity-50">
              Accept offer
            </button>
          </div>
        ) : next ? (
          <button
            type="button"
            disabled={busy}
            onClick={run(() => stageFns[next.fn]({ orderId: order._id }))}
            className="w-full bg-primary text-on-primary font-label-md py-2.5 rounded-full flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Icon name={next.icon} className="text-lg" /> {next.label}
          </button>
        ) : (
          <p className="text-center text-secondary font-label-sm flex items-center justify-center gap-1">
            <Icon name="check_circle" className="text-base" fill /> Delivered
          </p>
        )}
      </div>

      {/* Delay reporting on active deliveries */}
      {!pool && next ? (
        showDelay ? (
          <div className="mt-sm flex flex-wrap gap-2">
            {reasons.map((r) => (
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

function Leg({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center gap-sm bg-surface-container-low rounded-2xl px-3 py-2">
      <Icon name={icon} className="text-tertiary text-xl" />
      <div className="flex-grow min-w-0">
        <p className="font-label-sm text-tertiary text-[10px] uppercase tracking-wide">{label}</p>
        <p className="font-label-sm text-on-surface truncate">{value}</p>
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary font-label-sm">
          <Icon name="directions" className="text-lg" /> Map
        </a>
      ) : null}
    </div>
  );
}
