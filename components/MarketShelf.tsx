"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import MarketFoodCard from "./MarketFoodCard";

// A horizontal shelf of real, popular marketplace food on the home screen.
export default function MarketShelf() {
  const foods = useQuery(api.marketplace.listFood, { sort: "popular", limit: 8 });

  if (foods !== undefined && foods.length === 0) return null;

  return (
    <section className="mt-lg">
      <div className="flex items-end justify-between px-margin-mobile mb-sm">
        <h2 className="font-headline-md text-on-surface">Fresh on the marketplace</h2>
        <Link href="/market" className="text-primary font-label-md">
          See all
        </Link>
      </div>
      <div className="flex gap-gutter overflow-x-auto hide-scrollbar px-margin-mobile pb-1">
        {foods === undefined
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-40 h-56 rounded-3xl bg-surface-container-low animate-pulse flex-shrink-0" />
            ))
          : foods.map((f) => (
              <div key={f._id} className="w-40 flex-shrink-0">
                <MarketFoodCard food={f} />
              </div>
            ))}
      </div>
    </section>
  );
}
