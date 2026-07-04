"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ksh } from "@/lib/format";
import Icon from "@/components/Icon";

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-md ${
        accent
          ? "bg-primary text-on-primary"
          : "bg-surface smooth-shadow text-on-surface"
      }`}
    >
      <Icon
        name={icon}
        className={`text-2xl ${accent ? "text-on-primary/80" : "text-primary"}`}
      />
      <p className={`mt-2 font-headline-md text-[22px] tabular-nums`}>{value}</p>
      <p className={`font-label-sm ${accent ? "text-on-primary/80" : "text-tertiary"}`}>
        {label}
      </p>
    </div>
  );
}

export default function SellerDashboard() {
  const data = useQuery(api.sellerDashboard.summary);

  if (data === undefined) {
    return (
      <div className="px-margin-mobile pt-md grid grid-cols-2 gap-gutter">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-3xl bg-surface-container-low animate-pulse" />
        ))}
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="px-margin-mobile pt-lg text-center text-tertiary">
        No seller data yet.
      </div>
    );
  }

  const sub = data.subscription;

  return (
    <main>
      <header className="px-margin-mobile pt-base pb-sm sticky top-0 bg-surface z-10">
        <p className="font-label-sm text-tertiary uppercase tracking-wider">
          Seller dashboard
        </p>
        <h1 className="font-headline-md text-on-surface text-[24px]">
          Your business today
        </h1>
      </header>

      {/* Subscription / expiry reminder */}
      <section className="px-margin-mobile">
        <Link
          href="/subscription"
          className={`flex items-center gap-sm rounded-3xl p-md ${
            sub.active
              ? sub.expiringSoon
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-primary-fixed text-on-primary-fixed"
              : "bg-error-container text-on-error-container"
          }`}
        >
          <Icon
            name={sub.active ? "verified" : "error"}
            className="text-3xl"
            fill
          />
          <div className="flex-grow">
            <p className="font-label-md">
              {sub.active
                ? sub.expiringSoon
                  ? `Plan expires in ${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"}`
                  : `Subscription active · ${sub.daysLeft} days left`
                : "Subscription inactive — selling is disabled"}
            </p>
            <p className="font-label-sm opacity-80 capitalize">
              {sub.planKey ? `${sub.planKey} plan` : "No active plan"}
            </p>
          </div>
          <Icon name="chevron_right" />
        </Link>
      </section>

      <section className="px-margin-mobile mt-md grid grid-cols-2 gap-gutter">
        <StatCard label="Sales today" value={ksh(data.sales.today)} icon="payments" accent />
        <StatCard label="This week" value={ksh(data.sales.week)} icon="calendar_view_week" />
        <StatCard label="This month" value={ksh(data.sales.month)} icon="calendar_month" />
        <StatCard label="Est. profit" value={ksh(data.sales.estimatedProfit)} icon="trending_up" />
        <StatCard label="Items sold" value={String(data.sales.itemsSold)} icon="shopping_bag" />
        <StatCard label="Total orders" value={String(data.orders.total)} icon="receipt_long" />
      </section>

      {/* Orders breakdown */}
      <section className="px-margin-mobile mt-md">
        <div className="bg-surface rounded-3xl smooth-shadow p-md grid grid-cols-3 text-center">
          <div>
            <p className="font-headline-md text-[20px] text-secondary tabular-nums">
              {data.orders.completed}
            </p>
            <p className="font-label-sm text-tertiary">Completed</p>
          </div>
          <div className="border-x border-outline-variant/40">
            <p className="font-headline-md text-[20px] text-primary tabular-nums">
              {data.orders.pending}
            </p>
            <p className="font-label-sm text-tertiary">Pending</p>
          </div>
          <div>
            <p className="font-headline-md text-[20px] text-error tabular-nums">
              {data.orders.cancelled}
            </p>
            <p className="font-label-sm text-tertiary">Cancelled</p>
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className="px-margin-mobile mt-md">
        <div className="flex items-center justify-between mb-sm">
          <h2 className="font-headline-md text-on-surface text-[18px]">Listings</h2>
          <Link href="/seller/menu" className="text-primary font-label-md">
            Manage
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-gutter">
          <div className="bg-surface-container-low rounded-2xl py-sm text-center">
            <p className="font-headline-md text-[18px] tabular-nums">{data.listings.active}</p>
            <p className="font-label-sm text-tertiary">Active</p>
          </div>
          <div className="bg-surface-container-low rounded-2xl py-sm text-center">
            <p className="font-headline-md text-[18px] tabular-nums">{data.listings.draft}</p>
            <p className="font-label-sm text-tertiary">Drafts</p>
          </div>
          <div className="bg-surface-container-low rounded-2xl py-sm text-center">
            <p className="font-headline-md text-[18px] tabular-nums">{data.listings.soldOut}</p>
            <p className="font-label-sm text-tertiary">Sold out</p>
          </div>
        </div>
      </section>

      {/* Best sellers */}
      <section className="px-margin-mobile mt-md">
        <h2 className="font-headline-md text-on-surface text-[18px] mb-sm">
          Best sellers
        </h2>
        {data.bestSellers.length === 0 ? (
          <p className="text-tertiary font-body-md py-4">
            No sales yet. Publish food and share your shop to get going.
          </p>
        ) : (
          <ul className="bg-surface rounded-3xl smooth-shadow divide-y divide-outline-variant/40 overflow-hidden">
            {data.bestSellers.map((b, i) => (
              <li key={b.name} className="flex items-center gap-sm px-sm py-3">
                <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-sm">
                  {i + 1}
                </span>
                <span className="flex-grow font-label-md text-on-surface truncate">
                  {b.name}
                </span>
                <span className="font-label-sm text-tertiary">{b.soldCount} sold</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
