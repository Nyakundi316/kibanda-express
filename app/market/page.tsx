"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import MarketFoodCard from "@/components/MarketFoodCard";
import BottomNav from "@/components/BottomNav";
import Icon from "@/components/Icon";

const SORTS = [
  { key: "popular", label: "Popular" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "newest", label: "Newest" },
];

export default function MarketPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("popular");

  const cats = useQuery(api.marketplace.categories) ?? [];
  const shops = useQuery(api.marketplace.listShops, { q: q || undefined });
  const foods = useQuery(api.marketplace.listFood, {
    q: q || undefined,
    category,
    sort,
  });

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 bg-surface px-margin-mobile pt-base pb-sm shadow-sm">
        <h1 className="font-headline-md text-on-surface text-[22px] mb-sm">
          Marketplace
        </h1>
        <div className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2.5">
          <Icon name="search" className="text-tertiary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search food or shops…"
            className="flex-grow bg-transparent focus:outline-none text-body-md"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label="Clear">
              <Icon name="close" className="text-tertiary" />
            </button>
          ) : null}
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar mt-sm">
          {["All", ...cats].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full font-label-sm whitespace-nowrap transition-colors ${
                category === c ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      {/* Shops strip */}
      <section className="mt-md">
        <div className="flex items-center justify-between px-margin-mobile mb-sm">
          <h2 className="font-headline-md text-on-surface text-[18px]">Shops</h2>
        </div>
        <div className="flex gap-sm overflow-x-auto hide-scrollbar px-margin-mobile pb-1">
          {shops === undefined
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-40 h-24 rounded-3xl bg-surface-container-low animate-pulse flex-shrink-0" />
              ))
            : shops.length === 0
            ? <p className="text-tertiary font-label-sm">No shops found.</p>
            : shops.map((s) => (
                <Link
                  key={s._id}
                  href={`/shop/${s._id}`}
                  className="w-44 flex-shrink-0 rounded-3xl overflow-hidden bg-surface smooth-shadow"
                >
                  <div
                    className="h-20 bg-cover bg-center bg-surface-container-high relative"
                    style={s.banner ? { backgroundImage: `url('${s.banner}')` } : undefined}
                  >
                    {s.featured ? (
                      <span className="absolute top-1.5 left-1.5 bg-secondary text-on-secondary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        FEATURED
                      </span>
                    ) : null}
                  </div>
                  <div className="p-sm">
                    <p className="font-label-md text-on-surface truncate">{s.name}</p>
                    <p className="font-label-sm text-tertiary truncate flex items-center gap-0.5">
                      <Icon name="star" fill className="text-[12px] text-secondary" />
                      {s.ratingAvg.toFixed(1)} · {s.location}
                    </p>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* Food grid */}
      <section className="mt-md">
        <div className="flex items-center justify-between px-margin-mobile mb-sm">
          <h2 className="font-headline-md text-on-surface text-[18px]">Food</h2>
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-label-sm transition-colors ${
                  sort === s.key ? "bg-on-surface text-surface" : "bg-surface-container-low text-tertiary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {foods === undefined ? (
          <div className="grid grid-cols-2 gap-gutter px-margin-mobile">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-3xl bg-surface-container-low animate-pulse" />
            ))}
          </div>
        ) : foods.length === 0 ? (
          <p className="text-tertiary text-center py-lg">No food matches your search.</p>
        ) : (
          <div className="grid grid-cols-2 gap-gutter px-margin-mobile">
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
