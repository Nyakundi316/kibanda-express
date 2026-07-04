"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import MarketFoodCard from "@/components/MarketFoodCard";
import BottomNav from "@/components/BottomNav";
import Icon from "@/components/Icon";

export default function ShopPage() {
  const router = useRouter();
  const params = useParams();
  const shopId = params.shopId as Id<"shops">;
  const data = useQuery(api.shops.getPublic, { shopId });
  const [shared, setShared] = useState(false);

  if (data === undefined) {
    return (
      <div className="min-h-screen">
        <div className="h-56 bg-surface-container-low animate-pulse" />
        <div className="px-margin-mobile -mt-10 relative">
          <div className="h-36 rounded-3xl bg-surface-container-high animate-pulse" />
        </div>
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="min-h-screen pt-24 text-center px-margin-mobile">
        <Icon name="storefront" className="text-5xl text-tertiary" />
        <p className="text-tertiary mt-sm">This shop is unavailable.</p>
      </div>
    );
  }

  const { shop, foods } = data;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: shop.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 1500);
      }
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  };

  // "Most ordered" shelf only earns its space when there's a real menu below it.
  const popular =
    foods.length > 4
      ? [...foods]
          .filter((f) => f.soldCount > 0)
          .sort((a, b) => b.soldCount - a.soldCount)
          .slice(0, 4)
      : [];

  return (
    <div className="min-h-screen pb-28">
      {/* Hero */}
      <div
        className="h-56 bg-cover bg-center bg-surface-container-high relative"
        style={shop.banner ? { backgroundImage: `url('${shop.banner}')` } : undefined}
      >
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-base left-margin-mobile w-10 h-10 rounded-full bg-surface/90 backdrop-blur flex items-center justify-center shadow-sm"
          aria-label="Back"
        >
          <Icon name="arrow_back" className="text-on-surface" />
        </button>
        <button
          type="button"
          onClick={share}
          className="absolute top-base right-margin-mobile w-10 h-10 rounded-full bg-surface/90 backdrop-blur flex items-center justify-center shadow-sm"
          aria-label="Share this shop"
        >
          <Icon name={shared ? "check" : "share"} className="text-on-surface text-xl" />
        </button>
        {shop.featured ? (
          <span className="absolute bottom-sm right-margin-mobile bg-secondary text-on-secondary text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <Icon name="verified" fill className="text-sm" /> Featured
          </span>
        ) : null}
      </div>

      {/* Identity card + stat strip */}
      <section className="px-margin-mobile -mt-10 relative">
        <div className="bg-surface rounded-3xl smooth-shadow overflow-hidden">
          <div className="p-md pb-sm">
            <div className="flex items-start gap-sm">
              <div
                className="w-16 h-16 rounded-2xl bg-cover bg-center bg-surface-container-high ring-2 ring-surface flex-shrink-0"
                style={shop.logo ? { backgroundImage: `url('${shop.logo}')` } : undefined}
              />
              <div className="min-w-0 flex-grow">
                <h1 className="font-headline-md text-on-surface text-[20px] truncate">
                  {shop.name}
                </h1>
                <p className="font-label-sm text-tertiary flex items-center gap-1 mt-0.5">
                  <Icon name="location_on" className="text-[14px]" />
                  {shop.location}
                </p>
              </div>
            </div>
            {shop.description ? (
              <p className="font-body-md text-on-surface-variant mt-sm">
                {shop.description}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-3 divide-x divide-outline-variant/40 border-t border-outline-variant/40">
            <Stat
              icon="star"
              iconFill
              value={shop.ratingAvg.toFixed(1)}
              label={`${shop.ratingCount} rating${shop.ratingCount === 1 ? "" : "s"}`}
            />
            <Stat
              icon="schedule"
              value={`${shop.openHour ?? "—"}–${shop.closeHour ?? "—"}`}
              label="Open hours"
            />
            <Stat
              icon={shop.fulfilment.includes("delivery") ? "pedal_bike" : "storefront"}
              value={shop.fulfilment.map(cap).join(" · ")}
              label="Fulfilment"
            />
          </div>
        </div>
      </section>

      {popular.length > 0 ? (
        <section className="mt-lg">
          <h2 className="font-headline-md text-on-surface text-[18px] px-margin-mobile mb-sm">
            Most ordered
          </h2>
          <div className="flex gap-gutter overflow-x-auto hide-scrollbar px-margin-mobile pb-1">
            {popular.map((f) => (
              <div key={f._id} className="w-40 flex-shrink-0">
                <MarketFoodCard food={f} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="px-margin-mobile mt-lg">
        <h2 className="font-headline-md text-on-surface text-[18px] mb-sm">
          Menu ({foods.length})
        </h2>
        {foods.length === 0 ? (
          <p className="text-tertiary text-center py-lg">No items published yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-gutter">
            {foods.map((f) => (
              <MarketFoodCard key={f._id} food={f} />
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  );
}

function Stat({
  icon,
  iconFill,
  value,
  label,
}: {
  icon: string;
  iconFill?: boolean;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center py-sm px-1 text-center">
      <span className="flex items-center gap-1 font-label-md text-on-surface text-[13px]">
        <Icon name={icon} fill={iconFill} className="text-base text-secondary" />
        <span className="truncate max-w-24">{value}</span>
      </span>
      <span className="font-label-sm text-tertiary text-[10px] mt-0.5">{label}</span>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
