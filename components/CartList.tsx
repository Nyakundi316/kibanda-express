"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ksh } from "@/lib/format";
import Icon from "./Icon";

const DELIVERY_FEE = 80;
const SERVICE_FEE = 25;

export default function CartList() {
  const lines = useQuery(api.cart.list);
  const setQty = useMutation(api.cart.setQty);
  const remove = useMutation(api.cart.remove);

  if (lines === undefined) {
    return (
      <div className="px-margin-mobile pt-md flex flex-col gap-sm">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface-container-low rounded-3xl h-28 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center mt-24 px-margin-mobile">
        <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center mb-md">
          <Icon name="shopping_basket" className="text-5xl text-tertiary" />
        </div>
        <h2 className="font-headline-md text-on-surface mb-xs">
          Your basket is empty
        </h2>
        <p className="text-tertiary text-body-md mb-lg max-w-[260px]">
          Hungry? Browse the kibandas near you and add something tasty.
        </p>
        <Link
          href="/market"
          className="bg-primary text-on-primary font-label-md px-md py-3 rounded-full active:scale-95 transition-transform"
        >
          Explore the marketplace
        </Link>
      </div>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const total = subtotal + DELIVERY_FEE + SERVICE_FEE;

  const step = (id: Id<"cartLines">, delta: number) => setQty({ id, delta });

  return (
    <>
      <section className="px-margin-mobile pt-md">
        <div className="flex items-center gap-sm bg-secondary-container/60 rounded-2xl p-sm mb-md">
          <Icon name="pedal_bike" className="text-secondary text-2xl" />
          <div className="leading-tight">
            <p className="font-label-md text-on-secondary-container">
              Delivering to Westlands, Nairobi
            </p>
            <p className="font-label-sm text-tertiary">
              Arrives in 25–35 min · Rider assigned at checkout
            </p>
          </div>
        </div>

        <ul className="flex flex-col gap-sm">
          {lines.map((line) => (
            <li
              key={line._id}
              className="bg-surface rounded-3xl smooth-shadow p-sm flex gap-sm"
            >
              <div
                className="w-20 h-20 rounded-2xl bg-cover bg-center flex-shrink-0"
                style={{ backgroundImage: `url('${line.image}')` }}
              />
              <div className="flex-grow min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-label-md text-on-surface leading-tight">
                    {line.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => remove({ id: line._id })}
                    aria-label={`Remove ${line.name}`}
                    className="text-tertiary hover:text-error transition-colors -mt-1"
                  >
                    <Icon name="close" className="text-lg" />
                  </button>
                </div>
                <p className="font-label-sm text-tertiary mb-1">{line.vendor}</p>
                {line.note ? (
                  <p className="font-label-sm text-on-surface-variant italic truncate">
                    “{line.note}”
                  </p>
                ) : null}

                <div className="flex items-center justify-between mt-2">
                  <span className="font-headline-md text-primary text-[17px]">
                    {ksh(line.price * line.qty)}
                  </span>
                  <div className="flex items-center gap-3 bg-surface-container-high rounded-full px-1 py-1">
                    <button
                      type="button"
                      onClick={() => step(line._id, -1)}
                      aria-label="Decrease quantity"
                      className="w-7 h-7 rounded-full bg-surface flex items-center justify-center text-on-surface active:scale-90 transition-transform"
                    >
                      <Icon name="remove" className="text-lg" />
                    </button>
                    <span className="font-label-md w-4 text-center tabular-nums">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => step(line._id, 1)}
                      aria-label="Increase quantity"
                      className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center active:scale-90 transition-transform"
                    >
                      <Icon name="add" className="text-lg" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="w-full mt-md flex items-center gap-sm text-primary font-label-md py-3 rounded-2xl border border-dashed border-outline-variant active:scale-[0.99] transition-transform justify-center"
        >
          <Icon name="add" className="text-xl" />
          Add more from this kibanda
        </button>
      </section>

      <section className="px-margin-mobile mt-lg">
        <div className="bg-surface-container-low rounded-3xl p-md">
          <div className="flex justify-between text-on-surface-variant mb-2">
            <span>Subtotal</span>
            <span className="tabular-nums">{ksh(subtotal)}</span>
          </div>
          <div className="flex justify-between text-on-surface-variant mb-2">
            <span>Delivery fee</span>
            <span className="tabular-nums">{ksh(DELIVERY_FEE)}</span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>Service fee</span>
            <span className="tabular-nums">{ksh(SERVICE_FEE)}</span>
          </div>
          <div className="border-t border-outline-variant/60 my-sm" />
          <div className="flex justify-between items-center">
            <span className="font-headline-md text-on-surface">Total</span>
            <span className="font-headline-md text-primary text-[22px] tabular-nums">
              {ksh(total)}
            </span>
          </div>
        </div>

        <Link
          href="/checkout"
          className="w-full mt-md bg-primary text-on-primary font-label-md text-[16px] py-4 rounded-full flex items-center justify-center gap-sm active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
        >
          Checkout · {ksh(total)}
          <Icon name="arrow_forward" className="text-xl" />
        </Link>
      </section>
    </>
  );
}
