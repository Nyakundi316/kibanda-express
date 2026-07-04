"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { categories, catalog, type CatalogItem } from "@/lib/data";
import { ksh } from "@/lib/format";
import Icon from "./Icon";

export default function Categories() {
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState<string | null>(null);
  const addToCart = useMutation(api.cart.add);

  const activeLabel = categories[active].label;
  const items = catalog[activeLabel] ?? [];

  const handleAdd = async (item: CatalogItem) => {
    await addToCart({
      name: item.name,
      vendor: item.vendor,
      price: item.price,
      image: item.image,
    });
    setAdded(item.id);
    setTimeout(() => setAdded((id) => (id === item.id ? null : id)), 1200);
  };

  return (
    <section className="mt-md">
      <div className="flex overflow-x-auto hide-scrollbar gap-sm px-margin-mobile">
        {categories.map((cat, i) => {
          const isActive = active === i;
          return (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={isActive}
              className="flex flex-col items-center gap-xs flex-shrink-0 group"
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center group-active:scale-95 transition-transform ${
                  isActive
                    ? "bg-primary-container text-on-primary shadow-lg"
                    : "bg-surface-container-highest text-primary"
                }`}
              >
                <Icon name={cat.icon} className="text-3xl" />
              </div>
              <span
                className={`font-label-sm ${
                  isActive ? "text-primary font-semibold" : "text-on-surface-variant"
                }`}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between px-margin-mobile mt-md mb-sm">
        <h2 className="font-headline-md text-on-surface">{activeLabel}</h2>
        <span className="font-label-sm text-tertiary">{items.length} items</span>
      </div>

      <div className="flex gap-gutter overflow-x-auto hide-scrollbar px-margin-mobile pb-2 snap-x">
        {items.map((item) => {
          const isAdded = added === item.id;
          return (
            <article
              key={item.id}
              className="w-40 flex-shrink-0 snap-start bg-surface rounded-3xl smooth-shadow overflow-hidden flex flex-col"
            >
              <div className="h-28 w-full relative">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url('${item.image}')` }}
                />
                {item.tag ? (
                  <span className="absolute top-2 left-2 bg-surface/90 backdrop-blur text-on-surface font-label-sm px-2 py-0.5 rounded-full text-[10px]">
                    {item.tag}
                  </span>
                ) : null}
              </div>

              <div className="p-sm flex flex-col flex-grow">
                <h3 className="font-label-md text-on-surface leading-tight line-clamp-2">
                  {item.name}
                </h3>
                <p className="font-label-sm text-tertiary mb-base truncate">
                  {item.vendor}
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-headline-md text-primary text-[16px] tabular-nums">
                    {ksh(item.price)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdd(item)}
                    aria-label={`Add ${item.name} to cart`}
                    className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                      isAdded
                        ? "bg-primary text-on-primary"
                        : "bg-primary-container text-on-primary"
                    }`}
                  >
                    <Icon name={isAdded ? "check" : "add"} className="text-xl" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
