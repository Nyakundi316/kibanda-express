"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ksh } from "@/lib/format";
import { humanize } from "@/lib/errors";
import {
  etaCard,
  isTerminalBad,
  statusHeadline,
  journeySteps,
  currentStep,
} from "@/lib/journey";
import Icon from "./Icon";

type Order = Doc<"marketplaceOrders"> & { items: Doc<"marketplaceOrderItems">[] };

const STATUS: Record<string, { label: string; chip: string; icon: string }> = {
  pending: { label: "Awaiting seller", chip: "bg-surface-container-high text-tertiary", icon: "schedule" },
  accepted: { label: "Accepted", chip: "bg-primary-fixed text-on-primary-fixed", icon: "thumb_up" },
  preparing: { label: "Preparing", chip: "bg-primary-fixed text-on-primary-fixed", icon: "skillet" },
  ready: { label: "Ready", chip: "bg-secondary-container text-on-secondary-container", icon: "takeout_dining" },
  dispatched: { label: "On the way", chip: "bg-secondary-container text-on-secondary-container", icon: "pedal_bike" },
  completed: { label: "Completed", chip: "bg-secondary-container text-on-secondary-container", icon: "check_circle" },
  cancelled: { label: "Cancelled", chip: "bg-error-container text-on-error-container", icon: "cancel" },
  rejected: { label: "Rejected", chip: "bg-error-container text-on-error-container", icon: "block" },
  disputed: { label: "Issue raised", chip: "bg-error-container text-on-error-container", icon: "report" },
};

function isPast(o: Order): boolean {
  return (
    ["completed", "cancelled", "rejected"].includes(o.status) ||
    o.deliveryStatus === "delivered"
  );
}

export default function MyOrders() {
  const orders = useQuery(api.marketplaceOrders.myOrders) as Order[] | undefined;
  const [tab, setTab] = useState<"Active" | "Past">("Active");
  const justPlaced = useSearchParams().get("placed");

  if (orders === undefined) {
    return (
      <div className="px-margin-mobile mt-md flex flex-col gap-sm">
        <div className="h-44 rounded-3xl bg-surface-container-low animate-pulse" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-28 rounded-3xl bg-surface-container-low animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="px-margin-mobile pt-20 text-center">
        <Icon name="ramen_dining" className="text-5xl text-tertiary" />
        <h2 className="font-headline-md text-on-surface mt-sm mb-xs">No orders yet</h2>
        <p className="text-tertiary mb-lg">
          When you order food, you can track it here from kitchen to doorstep.
        </p>
        <Link
          href="/market"
          className="inline-flex items-center gap-1 bg-primary text-on-primary font-label-md px-md py-3 rounded-full"
        >
          <Icon name="storefront" className="text-lg" /> Browse the market
        </Link>
      </div>
    );
  }

  const active = orders.filter((o) => !isPast(o));
  const past = orders.filter(isPast);
  const list = tab === "Active" ? active : past;

  return (
    <>
      {justPlaced ? (
        <div className="px-margin-mobile mt-md">
          <p className="flex items-center gap-2 bg-secondary-container text-on-secondary-container rounded-2xl px-4 py-3 font-label-sm">
            <Icon name="check_circle" className="text-lg" fill />
            Order {justPlaced} placed — the seller has been notified.
          </p>
        </div>
      ) : null}

      {/* Live order hero — the most recent active order, tap through to track */}
      {active[0] ? <LiveOrderHero order={active[0]} /> : null}

      <div className="px-margin-mobile mt-lg">
        <div className="flex gap-2 bg-surface-container-low p-1 rounded-full w-fit">
          {(["Active", "Past"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-md py-2 rounded-full font-label-md transition-colors ${
                tab === t ? "bg-surface text-primary shadow-sm" : "text-tertiary"
              }`}
            >
              {t}
              <span className="ml-1 text-[11px] opacity-70">
                {t === "Active" ? active.length : past.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <section className="px-margin-mobile mt-md flex flex-col gap-sm">
        {list.length === 0 ? (
          <p className="text-tertiary text-center py-lg">
            No {tab.toLowerCase()} orders right now.
          </p>
        ) : (
          list.map((o) => <OrderCard key={o._id} order={o} />)
        )}
      </section>
    </>
  );
}

/** Dark hero card for the order that's in flight right now. */
function LiveOrderHero({ order }: { order: Order }) {
  const headline = statusHeadline(order, null);
  const eta = etaCard(order, null);
  const steps = journeySteps(order.fulfilment);
  const activeStep = currentStep(order);

  return (
    <section className="px-margin-mobile mt-md">
      <div className="rounded-3xl overflow-hidden bg-on-surface text-surface">
        <div className="p-md">
          <p className="font-label-sm text-surface/60 uppercase tracking-wider">
            {order.reference} · {order.shopName}
          </p>
          <p className="font-headline-md text-surface text-[22px] leading-tight mt-1">
            {eta ?? headline.title}
          </p>
          <p className="font-body-md text-surface/70 mt-1">{headline.message}</p>
        </div>

        <div className="flex items-center px-md pb-md">
          {steps.map((label, i) => {
            const done = i < activeStep;
            const isNow = i === activeStep;
            return (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] transition-colors ${
                    done
                      ? "bg-primary-container text-on-primary"
                      : isNow
                      ? "bg-primary-container text-on-primary ring-4 ring-primary-container/25"
                      : "bg-surface/15 text-surface/50"
                  }`}
                >
                  {done ? <Icon name="check" className="text-sm" /> : i + 1}
                </div>
                {i < steps.length - 1 ? (
                  <div
                    className={`h-1 flex-1 mx-1 rounded-full ${
                      i < activeStep ? "bg-primary-container" : "bg-surface/15"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <Link
          href={`/orders/${order._id}`}
          className="w-full bg-primary-container text-on-primary font-label-md py-3 flex items-center justify-center gap-sm active:opacity-90 transition-opacity"
        >
          <Icon name="map" className="text-xl" />
          Track your order
        </Link>
      </div>
    </section>
  );
}

function OrderCard({ order }: { order: Order }) {
  const meta = STATUS[order.status] ?? STATUS.pending;
  const eta = etaCard(order, null);
  const live = !isPast(order);

  return (
    <Link
      href={`/orders/${order._id}`}
      className="block bg-surface rounded-3xl smooth-shadow p-sm active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label-md text-on-surface truncate">{order.shopName}</p>
          <p className="font-label-sm text-tertiary">
            {order.reference} · {order.fulfilment}
          </p>
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.chip}`}>
          <Icon name={meta.icon} className="text-[14px]" fill />
          {meta.label}
        </span>
      </div>

      {live && eta && !isTerminalBad(order.status) ? (
        <p className="mt-2 flex items-center gap-1 font-label-sm text-primary">
          <Icon name="schedule" className="text-base" /> {eta}
        </p>
      ) : null}

      <ul className="mt-2 text-on-surface-variant font-label-sm">
        {order.items.map((it) => (
          <li key={it._id} className="flex justify-between">
            <span className="truncate">{it.qty}× {it.name}</span>
            <span className="tabular-nums">{ksh(it.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/40">
        <span className={`font-label-sm flex items-center gap-1 ${order.paymentStatus === "paid" ? "text-secondary" : "text-tertiary"}`}>
          <Icon name={order.paymentStatus === "paid" ? "check_circle" : "schedule"} className="text-base" />
          {order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "refunded" ? "Refunded" : order.paymentMethod === "mpesa" ? "Awaiting payment" : "Pay on delivery"}
        </span>
        <span className="flex items-center gap-1 font-label-md text-on-surface tabular-nums">
          {ksh(order.total)} <Icon name="chevron_right" className="text-tertiary text-lg" />
        </span>
      </div>

      {order.status === "completed" ? <ReorderButton orderId={order._id} /> : null}
    </Link>
  );
}

function ReorderButton({ orderId }: { orderId: Id<"marketplaceOrders"> }) {
  const router = useRouter();
  const reorder = useMutation(api.cart.reorder);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (e: React.MouseEvent) => {
    // The whole card is a link to the tracker — don't navigate there.
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setErr(null);
    try {
      await reorder({ orderId });
      router.push("/cart");
    } catch (ex) {
      setErr(humanize(ex));
      setBusy(false);
    }
  };

  return (
    <div className="mt-sm">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="w-full border border-primary text-primary font-label-md py-2 rounded-full flex items-center justify-center gap-1 active:scale-[0.99] transition-transform disabled:opacity-50"
      >
        <Icon name="replay" className="text-lg" />
        {busy ? "Adding to cart…" : "Reorder"}
      </button>
      {err ? <p className="text-error font-label-sm mt-1 text-center">{err}</p> : null}
    </div>
  );
}
