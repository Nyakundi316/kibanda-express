"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ksh } from "@/lib/format";
import { humanize } from "@/lib/errors";
import Icon from "@/components/Icon";

const tabs = ["Overview", "Orders", "Riders", "Sellers", "Payments"] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");

  return (
    <main>
      <div className="px-margin-mobile pt-md">
        <div className="flex gap-1 bg-surface-container-low p-1 rounded-full">
          {tabs.map((t) => (
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

      {tab === "Overview" ? <Overview /> : null}
      {tab === "Orders" ? <AdminOrders /> : null}
      {tab === "Riders" ? <AdminRiders /> : null}
      {tab === "Sellers" ? <Sellers /> : null}
      {tab === "Payments" ? <Payments /> : null}
    </main>
  );
}

const ORDER_FILTERS = ["active", "delayed", "late", "stuck", "disputed", "cancelled", "completed"] as const;

function AdminOrders() {
  const [filter, setFilter] = useState<(typeof ORDER_FILTERS)[number]>("active");
  const orders = useQuery(api.adminOrders.allOrders, { filter });
  const riders = useQuery(api.adminOrders.listRiders);
  const disputes = useQuery(api.adminOrders.listDisputes, { status: "open" });

  const assignRider = useMutation(api.adminOrders.assignRider);
  const overrideStatus = useMutation(api.adminOrders.overrideStatus);
  const createRefund = useMutation(api.adminOrders.createRefund);
  const resolveDispute = useMutation(api.adminOrders.resolveDispute);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => async () => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(humanize(e));
    }
  };

  const approvedRiders = (riders ?? []).filter((r) => r.verification === "approved");

  return (
    <section className="px-margin-mobile mt-md">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {ORDER_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full font-label-sm capitalize transition-colors ${
              filter === f ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {err ? <p className="text-error font-label-sm mb-sm">{err}</p> : null}

      {/* Open disputes */}
      {disputes && disputes.length > 0 ? (
        <div className="bg-error-container text-on-error-container rounded-3xl p-md mb-sm">
          <p className="font-label-md mb-sm flex items-center gap-1">
            <Icon name="report" className="text-lg" /> {disputes.length} open dispute{disputes.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-col gap-2">
            {disputes.map((d) => (
              <div key={d._id} className="flex items-center justify-between gap-2 bg-surface/60 rounded-2xl px-3 py-2">
                <div className="min-w-0">
                  <p className="font-label-sm text-on-surface truncate">{d.orderRef} · {d.reason}</p>
                  {d.details ? <p className="font-label-sm text-tertiary truncate">{d.details}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={run(() => resolveDispute({ disputeId: d._id, status: "resolved" }))}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-secondary text-on-secondary font-label-sm"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {orders === undefined ? (
        <div className="h-40 bg-surface-container-low rounded-3xl animate-pulse" />
      ) : orders.length === 0 ? (
        <p className="text-tertiary text-center py-lg">No {filter} orders.</p>
      ) : (
        <div className="flex flex-col gap-sm">
          {orders.map((o) => (
            <article key={o._id} className="bg-surface rounded-3xl smooth-shadow p-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-label-md text-on-surface">{o.reference} · {o.shopName}</p>
                  <p className="font-label-sm text-tertiary capitalize">
                    {o.status}
                    {o.deliveryStatus ? ` · ${o.deliveryStatus.replace(/_/g, " ")}` : ""}
                    {" · "}{o.paymentStatus}
                  </p>
                </div>
                {o.isLate ? <Badge label="late" tone="bad" /> : null}
              </div>

              <p className="font-label-sm text-tertiary mt-1">
                {o.customerName} · {o.fulfilment}
                {o.riderName ? ` · rider: ${o.riderName}` : ""}
              </p>

              {/* Assign / reassign rider */}
              {o.fulfilment === "delivery" && !["completed", "cancelled", "rejected"].includes(o.status) ? (
                <select
                  value=""
                  onChange={(e) => {
                    const riderId = e.target.value;
                    if (riderId) run(() => assignRider({ orderId: o._id, riderId: riderId as any }))();
                  }}
                  className="mt-sm w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-3 py-2.5 font-label-sm focus:outline-none focus:border-primary"
                >
                  <option value="">{o.riderName ? "Reassign rider…" : "Assign rider…"}</option>
                  {approvedRiders.map((r) => (
                    <option key={r._id} value={r.userId}>
                      {r.name} ({r.activeDeliveries} active)
                    </option>
                  ))}
                </select>
              ) : null}

              {/* Manual overrides */}
              {!["completed", "cancelled", "rejected"].includes(o.status) ? (
                <div className="grid grid-cols-2 gap-2 mt-sm">
                  <button
                    type="button"
                    onClick={run(() => overrideStatus({ orderId: o._id, axis: "order", orderStatus: "completed" }))}
                    className="py-2 rounded-full bg-secondary-container text-on-secondary-container font-label-sm"
                  >
                    Force complete
                  </button>
                  <button
                    type="button"
                    onClick={run(() => overrideStatus({ orderId: o._id, axis: "order", orderStatus: "cancelled" }))}
                    className="py-2 rounded-full bg-error-container text-on-error-container font-label-sm"
                  >
                    Force cancel
                  </button>
                </div>
              ) : null}

              {o.paymentStatus === "paid" ? (
                <button
                  type="button"
                  onClick={run(() => createRefund({ orderId: o._id, reason: "Admin refund" }))}
                  className="mt-2 w-full py-2 rounded-full border border-outline-variant text-on-surface-variant font-label-sm"
                >
                  Issue refund ({ksh(o.total)})
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AdminRiders() {
  const riders = useQuery(api.adminOrders.listRiders);
  const approveRider = useMutation(api.adminOrders.approveRider);
  const setRiderStatus = useMutation(api.adminOrders.setRiderStatus);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => async () => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(humanize(e));
    }
  };

  if (riders === undefined)
    return <div className="px-margin-mobile mt-md h-40 bg-surface-container-low rounded-3xl animate-pulse" />;
  if (riders.length === 0)
    return <p className="px-margin-mobile mt-lg text-tertiary text-center">No rider applications yet.</p>;

  return (
    <section className="px-margin-mobile mt-md flex flex-col gap-sm">
      {err ? <p className="text-error font-label-sm">{err}</p> : null}
      {riders.map((r) => (
        <article key={r._id} className="bg-surface rounded-3xl smooth-shadow p-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-label-md text-on-surface truncate">{r.name}</h3>
              <p className="font-label-sm text-tertiary capitalize">
                {r.vehicleType.replace("_", " ")}{r.vehiclePlate ? ` · ${r.vehiclePlate}` : ""}
              </p>
              <p className="font-label-sm text-tertiary">{r.phone}</p>
              <p className="font-label-sm text-tertiary">{r.activeDeliveries} active deliver{r.activeDeliveries === 1 ? "y" : "ies"}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge label={r.verification} tone={r.verification === "approved" ? "ok" : r.verification === "rejected" ? "bad" : "neutral"} />
              <Badge label={r.accountStatus} tone={r.accountStatus === "active" ? "ok" : "bad"} />
              <Badge label={r.availability} tone={r.availability === "online" ? "ok" : "neutral"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-sm">
            {r.verification === "pending" ? (
              <>
                <button type="button" onClick={run(() => approveRider({ riderUserId: r.userId, approve: true }))} className="py-2 rounded-full bg-secondary-container text-on-secondary-container font-label-sm">
                  Approve
                </button>
                <button type="button" onClick={run(() => approveRider({ riderUserId: r.userId, approve: false }))} className="py-2 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm">
                  Reject
                </button>
              </>
            ) : r.accountStatus === "active" ? (
              <button type="button" onClick={run(() => setRiderStatus({ riderUserId: r.userId, status: "suspended" }))} className="col-span-2 py-2 rounded-full bg-error-container text-on-error-container font-label-sm">
                Suspend
              </button>
            ) : (
              <button type="button" onClick={run(() => setRiderStatus({ riderUserId: r.userId, status: "active" }))} className="col-span-2 py-2 rounded-full bg-secondary text-on-secondary font-label-sm">
                Reinstate
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

function Overview() {
  const stats = useQuery(api.admin.platformStats);
  if (stats === undefined)
    return <div className="px-margin-mobile mt-md h-40 bg-surface-container-low rounded-3xl animate-pulse" />;

  const cards = [
    { label: "Customers", value: stats.customers, icon: "group" },
    { label: "Sellers", value: stats.sellers, icon: "storefront" },
    { label: "Active shops", value: stats.activeShops, icon: "store" },
    { label: "Food listings", value: stats.foodListings, icon: "lunch_dining" },
  ];

  return (
    <>
      <section className="px-margin-mobile mt-md grid grid-cols-2 gap-gutter">
        {cards.map((c) => (
          <div key={c.label} className="bg-surface rounded-3xl smooth-shadow p-md">
            <Icon name={c.icon} className="text-2xl text-primary" />
            <p className="mt-2 font-headline-md text-[22px] tabular-nums">{c.value}</p>
            <p className="font-label-sm text-tertiary">{c.label}</p>
          </div>
        ))}
      </section>
      <section className="px-margin-mobile mt-md">
        <div className="bg-primary text-on-primary rounded-3xl p-md">
          <p className="font-label-sm text-on-primary/80">Subscription revenue</p>
          <p className="font-headline-md text-[28px] tabular-nums">
            {ksh(stats.subscriptionRevenue)}
          </p>
        </div>
      </section>
    </>
  );
}

function Sellers() {
  const sellers = useQuery(api.admin.listSellers);
  const setVerification = useMutation(api.admin.setVerification);
  const setStatus = useMutation(api.admin.setSellerAccountStatus);
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => async () => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(humanize(e));
    }
  };

  if (sellers === undefined)
    return <div className="px-margin-mobile mt-md h-40 bg-surface-container-low rounded-3xl animate-pulse" />;
  if (sellers.length === 0)
    return <p className="px-margin-mobile mt-lg text-tertiary text-center">No sellers yet.</p>;

  return (
    <section className="px-margin-mobile mt-md flex flex-col gap-sm">
      {err ? <p className="text-error font-label-sm">{err}</p> : null}
      {sellers.map((s) => (
        <article key={s._id} className="bg-surface rounded-3xl smooth-shadow p-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-label-md text-on-surface truncate">{s.businessName}</h3>
              <p className="font-label-sm text-tertiary">
                {s.ownerName} · {s.location}
              </p>
              <p className="font-label-sm text-tertiary">{s.phone}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                label={s.verification}
                tone={s.verification === "verified" ? "ok" : s.verification === "rejected" ? "bad" : "neutral"}
              />
              <Badge
                label={s.accountStatus}
                tone={s.accountStatus === "active" ? "ok" : "bad"}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 text-label-sm">
            <span className={`font-label-sm ${s.subscription?.active ? "text-secondary" : "text-tertiary"}`}>
              {s.subscription
                ? `${s.subscription.planKey} · ${s.subscription.active ? "active" : s.subscription.status}`
                : "no subscription"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-sm">
            <button
              type="button"
              onClick={run(() => setVerification({ sellerUserId: s.userId, verification: "verified" }))}
              className="py-2 rounded-full bg-secondary-container text-on-secondary-container font-label-sm"
            >
              Verify
            </button>
            <button
              type="button"
              onClick={run(() => setVerification({ sellerUserId: s.userId, verification: "rejected" }))}
              className="py-2 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm"
            >
              Reject
            </button>
            {s.accountStatus === "active" ? (
              <>
                <button
                  type="button"
                  onClick={run(() => setStatus({ sellerUserId: s.userId, status: "suspended" }))}
                  className="py-2 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm"
                >
                  Suspend
                </button>
                <button
                  type="button"
                  onClick={run(() => setStatus({ sellerUserId: s.userId, status: "banned" }))}
                  className="py-2 rounded-full bg-error-container text-on-error-container font-label-sm"
                >
                  Ban
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={run(() => setStatus({ sellerUserId: s.userId, status: "active" }))}
                className="col-span-2 py-2 rounded-full bg-secondary text-on-secondary font-label-sm"
              >
                Reinstate
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

function Payments() {
  const payments = useQuery(api.admin.listSubscriptionPayments);
  if (payments === undefined)
    return <div className="px-margin-mobile mt-md h-40 bg-surface-container-low rounded-3xl animate-pulse" />;
  if (payments.length === 0)
    return <p className="px-margin-mobile mt-lg text-tertiary text-center">No payments yet.</p>;

  return (
    <section className="px-margin-mobile mt-md flex flex-col gap-sm">
      {payments.map((p) => (
        <div key={p._id} className="bg-surface rounded-3xl smooth-shadow p-sm flex items-center gap-sm">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              p.status === "success"
                ? "bg-secondary-container text-on-secondary-container"
                : p.status === "failed"
                ? "bg-error-container text-on-error-container"
                : "bg-surface-container-high text-tertiary"
            }`}
          >
            <Icon name={p.status === "success" ? "check" : p.status === "failed" ? "close" : "schedule"} />
          </div>
          <div className="flex-grow min-w-0">
            <p className="font-label-md text-on-surface capitalize">
              {p.planKey ?? "subscription"} · {ksh(p.amount)}
            </p>
            <p className="font-label-sm text-tertiary truncate">
              {p.mpesaReceipt ?? p.status} · {p.phone ?? ""}
            </p>
          </div>
          <span className="font-label-sm text-tertiary capitalize">{p.status}</span>
        </div>
      ))}
    </section>
  );
}

function Badge({ label, tone }: { label: string; tone: "ok" | "bad" | "neutral" }) {
  const cls = {
    ok: "bg-secondary-container text-on-secondary-container",
    bad: "bg-error-container text-on-error-container",
    neutral: "bg-surface-container-high text-tertiary",
  }[tone];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {label}
    </span>
  );
}
