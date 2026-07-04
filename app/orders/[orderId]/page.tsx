"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ksh } from "@/lib/format";
import { humanize } from "@/lib/errors";
import {
  journeySteps,
  currentStep,
  statusHeadline,
  etaCard,
  isTerminalBad,
  type JourneyView,
} from "@/lib/journey";
import Icon from "@/components/Icon";

export default function OrderTrackingPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId as Id<"marketplaceOrders">;
  const data = useQuery(api.orderTracking.trackOrder, { orderId });

  if (data === undefined) {
    return (
      <main className="min-h-screen px-margin-mobile pt-base">
        <div className="h-8 w-32 bg-surface-container-low rounded-full animate-pulse" />
        <div className="mt-md h-40 bg-surface-container-low rounded-3xl animate-pulse" />
        <div className="mt-sm h-56 bg-surface-container-low rounded-3xl animate-pulse" />
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="min-h-screen px-margin-mobile pt-24 text-center">
        <Icon name="receipt_long" className="text-5xl text-tertiary" />
        <h1 className="font-headline-md text-on-surface mt-sm mb-xs">Order not found</h1>
        <p className="text-tertiary mb-lg">This order doesn’t exist or isn’t yours.</p>
        <Link href="/orders" className="bg-primary text-on-primary font-label-md px-md py-3 rounded-full">
          Back to orders
        </Link>
      </main>
    );
  }

  const { order, items, seller, rider, timeline, canCancel, dispute } = data;
  const view: JourneyView = order;
  const headline = statusHeadline(view, rider?.name);
  const eta = etaCard(view, rider?.name);
  const bad = isTerminalBad(order.status);

  return (
    <main className="min-h-screen pb-28 bg-surface-container-low/40">
      <header className="sticky top-0 z-40 flex items-center gap-2 px-margin-mobile py-base bg-surface shadow-sm">
        <Link href="/orders" aria-label="Back" className="text-tertiary -ml-1">
          <Icon name="arrow_back_ios_new" className="text-xl" />
        </Link>
        <div className="leading-tight">
          <h1 className="font-headline-md text-on-surface text-[18px]">{order.shopName}</h1>
          <p className="font-label-sm text-tertiary">
            Order {order.reference} · {order.fulfilment}
          </p>
        </div>
      </header>

      {/* 2 — Current status + big ETA */}
      <section className="px-margin-mobile mt-md">
        <div
          className={`rounded-3xl p-lg ${
            bad
              ? "bg-error-container text-on-error-container"
              : order.status === "completed" || order.deliveryStatus === "delivered"
              ? "bg-primary-fixed text-on-primary-fixed"
              : "bg-primary text-on-primary"
          }`}
        >
          {eta ? (
            <p className="font-headline-md text-[26px] leading-tight">{eta}</p>
          ) : (
            <p className="font-headline-md text-[22px] leading-tight">{headline.title}</p>
          )}
          <p className={`mt-1 font-body-md ${bad ? "" : "opacity-90"}`}>{headline.message}</p>
          {order.delayReason && !bad ? (
            <p className="mt-sm inline-flex items-center gap-1 bg-black/10 rounded-full px-3 py-1 font-label-sm">
              <Icon name="schedule" className="text-base" /> Delayed: {order.delayReason}
            </p>
          ) : null}
        </div>
      </section>

      {/* 3 — Delivery stepper */}
      {!bad ? <Stepper view={view} /> : null}

      {/* 4 — Rider */}
      {rider ? (
        <Card title="Your rider" icon="sports_motorsports">
          <div className="flex items-center gap-sm">
            <div className="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-headline-md">
              {rider.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <p className="font-label-md text-on-surface">{rider.name}</p>
              <p className="font-label-sm text-tertiary capitalize">
                {rider.vehicleType.replace("_", " ")}
                {rider.vehiclePlate ? ` · ${rider.vehiclePlate}` : ""}
              </p>
            </div>
            <a
              href={`tel:${rider.phone}`}
              className="flex items-center gap-1 bg-primary text-on-primary font-label-md px-4 py-2.5 rounded-full active:scale-95 transition-transform"
            >
              <Icon name="call" className="text-lg" /> Call
            </a>
          </div>
        </Card>
      ) : null}

      {/* 5 — Seller */}
      <Card title="Seller" icon="storefront">
        <div className="flex items-center gap-sm">
          <div className="flex-grow min-w-0">
            <p className="font-label-md text-on-surface truncate">{seller.name}</p>
            <p className="font-label-sm text-tertiary">{order.fulfilment === "pickup" ? "Collect in person" : "Cooking your order"}</p>
          </div>
          {seller.phone ? (
            <a
              href={`tel:${seller.phone}`}
              className="flex items-center gap-1 border border-primary text-primary font-label-md px-4 py-2.5 rounded-full active:scale-95 transition-transform"
            >
              <Icon name="call" className="text-lg" /> Call
            </a>
          ) : null}
        </div>
      </Card>

      {/* 6 — Items */}
      <Card title="Your order" icon="lunch_dining">
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it._id} className="flex justify-between font-label-sm text-on-surface-variant">
              <span className="truncate">{it.qty}× {it.name}</span>
              <span className="tabular-nums">{ksh(it.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {order.address ? (
          <p className="mt-sm pt-sm border-t border-outline-variant/40 font-label-sm text-tertiary flex items-start gap-1">
            <Icon name="location_on" className="text-base mt-0.5" /> {order.address}
          </p>
        ) : null}
        {order.note ? (
          <p className="mt-1 font-label-sm text-tertiary italic flex items-start gap-1">
            <Icon name="sticky_note_2" className="text-base mt-0.5" /> “{order.note}”
          </p>
        ) : null}
      </Card>

      {/* 7 — Payment */}
      <Card title="Payment" icon="receipt">
        <PayRow label="Subtotal" value={ksh(order.subtotal)} />
        {order.deliveryFee > 0 ? <PayRow label="Delivery fee" value={ksh(order.deliveryFee)} /> : null}
        <PayRow label="Service fee" value={ksh(order.serviceFee)} />
        <div className="border-t border-outline-variant/50 my-2" />
        <div className="flex justify-between items-center">
          <span className="font-label-md text-on-surface">Total</span>
          <span className="font-headline-md text-primary text-[18px] tabular-nums">{ksh(order.total)}</span>
        </div>
        <PaymentBadge method={order.paymentMethod} status={order.paymentStatus} />
      </Card>

      {/* Journey timeline (from audit history) */}
      {timeline.length > 0 ? (
        <Card title="Order journey" icon="timeline">
          <ol className="relative border-l-2 border-outline-variant/50 ml-1 pl-4 flex flex-col gap-3">
            {timeline.map((t) => (
              <li key={t._id} className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                <p className="font-label-sm text-on-surface">{timelineLabel(t.axis, t.newValue, t.note)}</p>
                <p className="font-label-sm text-tertiary text-[11px]">
                  {new Date(t.createdAt).toLocaleString([], { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {/* 8 — Help */}
      <HelpSection orderId={orderId} canCancel={canCancel} disputeOpen={!!dispute && dispute.status !== "resolved"} />
    </main>
  );
}

// Vertical progress timeline — done steps in the green secondary, the live
// step pulsing in primary, upcoming steps muted.
function Stepper({ view }: { view: JourneyView }) {
  const steps = journeySteps(view.fulfilment);
  const active = currentStep(view);
  return (
    <section className="px-margin-mobile mt-sm">
      <div className="bg-surface rounded-3xl smooth-shadow p-md">
        <ol className="flex flex-col">
          {steps.map((label, i) => {
            const done = i < active;
            const isNow = i === active;
            const last = i === steps.length - 1;
            return (
              <li key={label} className="flex gap-sm">
                <div className="flex flex-col items-center">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] flex-shrink-0 ${
                      done
                        ? "bg-secondary-container text-on-secondary-container"
                        : isNow
                        ? "bg-primary text-on-primary ring-4 ring-primary/15"
                        : "bg-surface-container-high text-tertiary"
                    }`}
                  >
                    {done ? (
                      <Icon name="check" className="text-base" />
                    ) : isNow ? (
                      <span className="w-2 h-2 rounded-full bg-on-primary animate-pulse" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {!last ? (
                    <span
                      className={`w-0.5 flex-grow min-h-3 my-0.5 rounded-full ${
                        i < active ? "bg-secondary-container" : "bg-outline-variant/50"
                      }`}
                    />
                  ) : null}
                </div>
                <p
                  className={`pt-1 font-label-md ${last ? "" : "pb-4"} ${
                    isNow
                      ? "text-primary"
                      : done
                      ? "text-on-surface"
                      : "text-tertiary"
                  }`}
                >
                  {label}
                  {isNow ? (
                    <span className="block font-label-sm text-tertiary font-normal">
                      Happening now
                    </span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="px-margin-mobile mt-sm">
      <div className="bg-surface rounded-3xl smooth-shadow p-md">
        <h2 className="flex items-center gap-1 font-label-sm text-tertiary uppercase tracking-wider mb-sm">
          <Icon name={icon} className="text-base" /> {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function PayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between font-label-sm text-on-surface-variant mb-1">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function PaymentBadge({ method, status }: { method: string; status: string }) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    paid: { label: "Paid", cls: "text-secondary", icon: "check_circle" },
    pending: { label: method === "mpesa" ? "Awaiting M-Pesa" : "Pay on delivery", cls: "text-tertiary", icon: "schedule" },
    failed: { label: "Payment failed", cls: "text-error", icon: "error" },
    refunded: { label: "Refunded", cls: "text-secondary", icon: "undo" },
  };
  const m = map[status] ?? map.pending;
  return (
    <p className={`mt-2 flex items-center gap-1 font-label-sm ${m.cls}`}>
      <Icon name={m.icon} className="text-base" /> {m.label}
    </p>
  );
}

function HelpSection({
  orderId,
  canCancel,
  disputeOpen,
}: {
  orderId: Id<"marketplaceOrders">;
  canCancel: boolean;
  disputeOpen: boolean;
}) {
  const router = useRouter();
  const reasons = useQuery(api.orderTracking.reportReasons) ?? [];
  const report = useMutation(api.orderTracking.reportProblem);
  const cancel = useMutation(api.marketplaceOrders.cancelOrder);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setErr(null);
    try {
      await report({ orderId, reason, details: details || undefined });
      setSent(true);
      setOpen(false);
    } catch (e) {
      setErr(humanize(e));
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    setBusy(true);
    setErr(null);
    try {
      await cancel({ orderId });
      router.push("/orders");
    } catch (e) {
      setErr(humanize(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="px-margin-mobile mt-sm">
      <div className="bg-surface rounded-3xl smooth-shadow p-md">
        <h2 className="flex items-center gap-1 font-label-sm text-tertiary uppercase tracking-wider mb-sm">
          <Icon name="support_agent" className="text-base" /> Need help?
        </h2>

        {sent || disputeOpen ? (
          <p className="font-label-sm text-secondary flex items-center gap-1 mb-sm">
            <Icon name="check_circle" className="text-base" /> We’ve logged your issue — support will follow up.
          </p>
        ) : !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full flex items-center justify-center gap-1 border border-outline-variant text-on-surface-variant font-label-md py-2.5 rounded-full"
          >
            <Icon name="flag" className="text-lg" /> Report a problem
          </button>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2 mb-sm">
              {reasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-full font-label-sm transition-colors ${
                    reason === r ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              placeholder="Add details (optional)"
              className="w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-2.5 mb-sm focus:outline-none focus:border-primary resize-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-outline-variant text-on-surface-variant font-label-md py-2.5 rounded-full">
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !reason}
                className="flex-1 bg-primary text-on-primary font-label-md py-2.5 rounded-full disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {canCancel ? (
          <button
            type="button"
            onClick={doCancel}
            disabled={busy}
            className="mt-sm w-full text-error font-label-sm py-2 disabled:opacity-50"
          >
            Cancel this order
          </button>
        ) : null}

        {err ? <p className="text-error font-label-sm mt-2">{err}</p> : null}
      </div>
    </section>
  );
}

function timelineLabel(axis: string, value: string, note?: string): string {
  if (note) return note;
  const labels: Record<string, string> = {
    pending: "Order placed",
    accepted: "Seller accepted the order",
    preparing: "Food is being prepared",
    ready: "Food is ready",
    completed: "Order completed",
    cancelled: "Order cancelled",
    rejected: "Order rejected",
    assigned: "Rider assigned",
    rider_accepted: "Rider accepted the delivery",
    going_to_seller: "Rider heading to the restaurant",
    at_seller: "Rider arrived at the restaurant",
    picked_up: "Rider picked up the order",
    on_the_way: "Rider on the way to you",
    near_customer: "Rider is nearby",
    delivered: "Order delivered",
    failed: "Delivery problem",
  };
  return labels[value] ?? `${axis}: ${value}`;
}
