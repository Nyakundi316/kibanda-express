"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ksh } from "@/lib/format";
import Icon from "@/components/Icon";

export default function FoodDetailPage() {
  const router = useRouter();
  const params = useParams();
  const foodId = params.foodId as Id<"foodItems">;
  const data = useQuery(api.marketplace.foodDetail, { foodId });
  const addFood = useMutation(api.cart.addFood);

  const [qty, setQty] = useState(1);
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");

  if (data === undefined) {
    return <div className="min-h-screen"><div className="h-72 bg-surface-container-low animate-pulse" /></div>;
  }
  if (data === null) {
    return (
      <div className="min-h-screen pt-24 text-center px-margin-mobile">
        <Icon name="no_meals" className="text-5xl text-tertiary" />
        <p className="text-tertiary mt-sm">This item is unavailable.</p>
        <Link href="/market" className="text-primary font-label-md mt-md inline-block">
          Back to marketplace
        </Link>
      </div>
    );
  }

  const { food, shop } = data;
  const soldOut = food.availability !== "available";

  const add = async () => {
    setState("adding");
    try {
      await addFood({ foodId: food._id, qty });
      setState("added");
      setTimeout(() => setState("idle"), 1200);
    } catch (err) {
      setState("idle");
      const msg = err instanceof Error ? err.message : "";
      if (/auth/i.test(msg)) router.push("/signin");
    }
  };

  return (
    <div className="min-h-screen pb-28">
      <div
        className="h-72 bg-cover bg-center bg-surface-container-high relative"
        style={food.image ? { backgroundImage: `url('${food.image}')` } : undefined}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-base left-margin-mobile w-9 h-9 rounded-full bg-surface/90 backdrop-blur flex items-center justify-center"
          aria-label="Back"
        >
          <Icon name="arrow_back" className="text-on-surface" />
        </button>
      </div>

      <section className="px-margin-mobile -mt-6 relative">
        <div className="bg-surface rounded-3xl smooth-shadow p-md">
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-headline-md text-on-surface text-[22px]">{food.name}</h1>
            <span className="font-headline-md text-primary text-[20px] whitespace-nowrap tabular-nums">
              {ksh(food.price)}
            </span>
          </div>

          <Link href={`/shop/${shop._id}`} className="inline-flex items-center gap-1 text-tertiary font-label-sm mt-1">
            <Icon name="storefront" className="text-base" />
            {shop.name} · {shop.location}
          </Link>

          <div className="flex flex-wrap gap-2 mt-sm">
            <span className="bg-surface-container-low px-2.5 py-1 rounded-full font-label-sm text-on-surface-variant">
              {food.category}
            </span>
            {food.prepTimeMins ? (
              <span className="inline-flex items-center gap-1 bg-surface-container-low px-2.5 py-1 rounded-full font-label-sm text-on-surface-variant">
                <Icon name="timer" className="text-base" /> {food.prepTimeMins} min
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 bg-surface-container-low px-2.5 py-1 rounded-full font-label-sm text-on-surface-variant">
              <Icon name="local_fire_department" className="text-base" /> {food.soldCount} sold
            </span>
          </div>

          {food.description ? (
            <p className="font-body-md text-on-surface-variant mt-sm">{food.description}</p>
          ) : null}

          {food.tags.length ? (
            <div className="flex flex-wrap gap-1.5 mt-sm">
              {food.tags.map((t) => (
                <span key={t} className="text-[11px] text-tertiary bg-surface-container-high px-2 py-0.5 rounded-full">
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Sticky add bar */}
      <div className="fixed bottom-0 inset-x-0 bg-surface border-t border-outline-variant/40 px-margin-mobile py-3 flex items-center gap-sm">
        <div className="flex items-center gap-3 bg-surface-container-high rounded-full px-1 py-1">
          <button
            type="button"
            onClick={() => setQty((n) => Math.max(1, n - 1))}
            className="w-8 h-8 rounded-full bg-surface flex items-center justify-center"
            aria-label="Decrease"
          >
            <Icon name="remove" />
          </button>
          <span className="w-5 text-center font-label-md tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((n) => n + 1)}
            className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center"
            aria-label="Increase"
          >
            <Icon name="add" />
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={soldOut || state === "adding"}
          className="flex-grow bg-primary text-on-primary font-label-md py-3.5 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <Icon
            name={state === "adding" ? "progress_activity" : state === "added" ? "check" : "add_shopping_cart"}
            className={state === "adding" ? "animate-spin" : ""}
          />
          {soldOut ? "Sold out" : state === "added" ? "Added" : `Add · ${ksh(food.price * qty)}`}
        </button>
      </div>
    </div>
  );
}
