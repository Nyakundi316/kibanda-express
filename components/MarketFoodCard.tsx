"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ksh } from "@/lib/format";
import Icon from "./Icon";

type Food = {
  _id: Id<"foodItems">;
  name: string;
  price: number;
  image?: string;
  category: string;
  availability: "available" | "unavailable" | "sold_out";
  shopName?: string;
  prepTimeMins?: number;
};

export default function MarketFoodCard({ food }: { food: Food }) {
  const router = useRouter();
  const addFood = useMutation(api.cart.addFood);
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");

  const soldOut = food.availability !== "available";

  const add = async () => {
    setState("adding");
    try {
      await addFood({ foodId: food._id });
      setState("added");
      setTimeout(() => setState("idle"), 1200);
    } catch (err) {
      setState("idle");
      // Most likely "Not authenticated" → send them to sign in.
      const msg = err instanceof Error ? err.message : "";
      if (/auth/i.test(msg)) router.push("/signin");
    }
  };

  return (
    <article className="bg-surface rounded-3xl smooth-shadow overflow-hidden flex flex-col">
      <div className="relative">
        <Link href={`/food/${food._id}`} className="block h-36 relative">
          <div
            className="absolute inset-0 bg-cover bg-center bg-surface-container-high"
            style={food.image ? { backgroundImage: `url('${food.image}')` } : undefined}
          />
          {food.prepTimeMins ? (
            <span className="absolute top-2 left-2 flex items-center gap-0.5 bg-surface/90 backdrop-blur text-on-surface font-label-sm text-[10px] px-2 py-0.5 rounded-full">
              <Icon name="schedule" className="text-[12px]" />
              {food.prepTimeMins} min
            </span>
          ) : null}
          {soldOut ? (
            <span className="absolute inset-0 bg-on-surface/50 flex items-center justify-center text-surface font-label-md">
              Sold out
            </span>
          ) : null}
        </Link>
        {!soldOut ? (
          <button
            type="button"
            onClick={add}
            disabled={state === "adding"}
            aria-label={`Add ${food.name} to cart`}
            className={`absolute bottom-2 right-2 w-9 h-9 rounded-full shadow-md flex items-center justify-center active:scale-90 transition-all ${
              state === "added"
                ? "bg-secondary text-on-secondary"
                : "bg-surface text-primary"
            }`}
          >
            <Icon
              name={state === "adding" ? "progress_activity" : state === "added" ? "check" : "add"}
              className={state === "adding" ? "text-xl animate-spin" : "text-xl"}
            />
          </button>
        ) : null}
      </div>
      <Link href={`/food/${food._id}`} className="p-sm flex flex-col flex-grow">
        <h3 className="font-label-md text-on-surface leading-tight line-clamp-1">
          {food.name}
        </h3>
        {food.shopName ? (
          <p className="font-label-sm text-tertiary truncate">{food.shopName}</p>
        ) : null}
        <span className="mt-auto pt-base font-headline-md text-primary text-[16px] tabular-nums">
          {ksh(food.price)}
        </span>
      </Link>
    </article>
  );
}
