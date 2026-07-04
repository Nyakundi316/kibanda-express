"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ksh } from "@/lib/format";
import Icon from "./Icon";

export default function PopularMeals() {
  const meals = useQuery(api.meals.list);
  const addToCart = useMutation(api.cart.add);
  const [justAdded, setJustAdded] = useState<Id<"meals"> | null>(null);

  const handleAdd = async (meal: NonNullable<typeof meals>[number]) => {
    await addToCart({
      name: meal.name,
      vendor: meal.vendor ?? "Kibanda Express",
      price: meal.price,
      image: meal.image,
    });
    setJustAdded(meal._id);
    setTimeout(() => setJustAdded((id) => (id === meal._id ? null : id)), 1200);
  };

  return (
    <section className="mt-lg px-margin-mobile">
      <div className="flex justify-between items-end mb-sm">
        <h2 className="font-headline-md text-on-surface">Popular Meals</h2>
        <button type="button" className="text-primary font-label-md">
          See Menu
        </button>
      </div>
      <div className="grid grid-cols-2 gap-gutter">
        {meals === undefined
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface-container-low rounded-3xl h-56 animate-pulse"
              />
            ))
          : meals.map((meal) => (
              <div
                key={meal._id}
                className="bg-surface rounded-3xl smooth-shadow overflow-hidden flex flex-col group"
              >
                <div className="h-32 w-full relative">
                  <div
                    className="absolute inset-0 bg-cover bg-center rounded-t-3xl"
                    style={{ backgroundImage: `url('${meal.image}')` }}
                  />
                </div>
                <div className="p-sm flex-grow flex flex-col">
                  <h4 className="font-label-md text-on-surface leading-tight mb-xs">
                    {meal.name}
                  </h4>
                  <div className="flex items-center gap-1 mb-base">
                    <Icon name="star" fill className="text-xs text-secondary" />
                    <span className="text-[10px] text-tertiary">
                      {meal.rating}
                    </span>
                  </div>
                  <div className="mt-auto flex justify-between items-center">
                    <span className="font-headline-md text-primary text-[18px]">
                      {ksh(meal.price)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdd(meal)}
                      aria-label={`Add ${meal.name} to cart`}
                      className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                        justAdded === meal._id
                          ? "bg-primary text-on-primary"
                          : "bg-primary-container text-on-primary"
                      }`}
                    >
                      <Icon
                        name={justAdded === meal._id ? "check" : "add"}
                        className="text-xl"
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}
