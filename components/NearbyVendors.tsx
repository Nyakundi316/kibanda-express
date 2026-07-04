"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Icon from "./Icon";

export default function NearbyVendors() {
  const vendors = useQuery(api.vendors.list);

  return (
    <section className="mt-lg">
      <div className="flex justify-between items-end px-margin-mobile mb-sm">
        <h2 className="font-headline-md text-on-surface text-[20px]">Kibandas near you</h2>
        <Link href="/market" className="text-primary font-label-md">
          All
        </Link>
      </div>
      <div className="flex overflow-x-auto hide-scrollbar gap-gutter px-margin-mobile">
        {vendors === undefined
          ? Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="w-[270px] flex-shrink-0 bg-surface-container-low rounded-3xl h-60 animate-pulse"
              />
            ))
          : vendors.map((vendor) => (
              <div
                key={vendor._id}
                className="w-[270px] flex-shrink-0 bg-surface rounded-3xl smooth-shadow overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div className="h-36 w-full relative">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url('${vendor.image}')` }}
                  />
                  <div className="absolute top-3 right-3 bg-surface/90 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
                    <Icon name="star" fill className="text-secondary text-sm" />
                    <span className="font-label-sm text-on-surface">
                      {vendor.rating}
                    </span>
                  </div>
                </div>
                <div className="p-sm">
                  <h3 className="font-label-md text-on-surface text-[15px]">
                    {vendor.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 bg-surface-container-low text-on-surface-variant font-label-sm text-[11px] px-2 py-0.5 rounded-full">
                      <Icon name="schedule" className="text-[13px]" />
                      {vendor.time}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-surface-container-low text-on-surface-variant font-label-sm text-[11px] px-2 py-0.5 rounded-full">
                      <Icon name="pedal_bike" className="text-[13px]" />
                      {vendor.delivery}
                    </span>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}
