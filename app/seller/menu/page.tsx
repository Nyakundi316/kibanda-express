"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ksh } from "@/lib/format";
import { humanize } from "@/lib/errors";
import Icon from "@/components/Icon";

export default function MenuPage() {
  const shop = useQuery(api.shops.myShop);
  const items = useQuery(api.foodItems.listMine);
  const createDraft = useMutation(api.foodItems.createDraft);

  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createDraft({ name, image: image || undefined });
      setName("");
      setImage("");
    } catch (err) {
      setError(humanize(err));
    } finally {
      setBusy(false);
    }
  };

  if (shop === undefined) {
    return <div className="px-margin-mobile pt-md h-40 bg-surface-container-low rounded-3xl animate-pulse" />;
  }

  if (shop === null) {
    return (
      <div className="px-margin-mobile pt-24 text-center">
        <Icon name="storefront" className="text-5xl text-tertiary" />
        <h2 className="font-headline-md text-on-surface mt-sm mb-xs">Create your shop first</h2>
        <p className="text-tertiary mb-lg">You need a shop before adding food.</p>
        <a href="/seller/shop" className="bg-primary text-on-primary font-label-md px-md py-3 rounded-full">
          Create shop
        </a>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="px-margin-mobile pt-base pb-sm">
        <h1 className="font-headline-md text-on-surface text-[24px]">Your menu</h1>
        <p className="text-tertiary font-label-sm">{shop.name}</p>
      </header>

      {/* Fast add */}
      <section className="px-margin-mobile">
        <div className="bg-surface rounded-3xl smooth-shadow p-md">
          <p className="font-label-md text-on-surface mb-sm flex items-center gap-1">
            <Icon name="bolt" className="text-secondary" /> Add food fast
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What are you selling? e.g. Beef Pilau"
            className="w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 mb-sm focus:outline-none focus:border-primary"
          />
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Photo URL (optional — snap & paste a link)"
            className="w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary"
          />
          {error ? (
            <p className="text-error font-label-sm mt-sm flex items-center gap-1">
              <Icon name="error" className="text-base" /> {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={add}
            disabled={busy || !name.trim()}
            className="mt-sm w-full bg-primary text-on-primary font-label-md py-3 rounded-full flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Icon name={busy ? "progress_activity" : "auto_awesome"} className={busy ? "animate-spin" : ""} />
            Create draft listing
          </button>
          <p className="text-tertiary font-label-sm mt-2 text-center">
            We’ll auto-fill the category, tags and a description. You set the
            price and publish.
          </p>
        </div>
      </section>

      <section className="px-margin-mobile mt-lg flex flex-col gap-sm pb-8">
        {items === undefined ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 rounded-3xl bg-surface-container-low animate-pulse" />
          ))
        ) : items.length === 0 ? (
          <p className="text-tertiary text-center py-lg">
            No food yet. Add your first item above.
          </p>
        ) : (
          items.map((item) => <FoodCard key={item._id} item={item} />)
        )}
      </section>
    </main>
  );
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-surface-container-high text-tertiary",
  published: "bg-secondary-container text-on-secondary-container",
  archived: "bg-error-container text-on-error-container",
};

const AVAIL: { key: "available" | "unavailable" | "sold_out"; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "sold_out", label: "Sold out" },
  { key: "unavailable", label: "Off" },
];

function FoodCard({ item }: { item: Doc<"foodItems"> }) {
  const update = useMutation(api.foodItems.update);
  const publish = useMutation(api.foodItems.publish);
  const setAvailability = useMutation(api.foodItems.setAvailability);
  const setStatus = useMutation(api.foodItems.setStatus);
  const remove = useMutation(api.foodItems.remove);

  const [price, setPrice] = useState(String(item.price));
  const [qty, setQty] = useState(String(item.quantity));
  const [err, setErr] = useState<string | null>(null);

  const dirty = price !== String(item.price) || qty !== String(item.quantity);

  const run = (fn: () => Promise<unknown>) => async () => {
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(humanize(e));
    }
  };

  return (
    <article className="bg-surface rounded-3xl smooth-shadow overflow-hidden">
      <div className="flex gap-sm p-sm">
        <div
          className="w-20 h-20 rounded-2xl bg-cover bg-center bg-surface-container-high flex-shrink-0 flex items-center justify-center"
          style={item.image ? { backgroundImage: `url('${item.image}')` } : undefined}
        >
          {!item.image ? <Icon name="restaurant" className="text-tertiary text-2xl" /> : null}
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-label-md text-on-surface truncate">{item.name}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[item.status]}`}>
              {item.status}
            </span>
          </div>
          <p className="font-label-sm text-tertiary">{item.category}</p>
          <div className="flex gap-sm mt-2">
            <label className="flex-1">
              <span className="text-[10px] text-tertiary">Price (KSh)</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl bg-surface-container-low border border-outline-variant/50 px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex-1">
              <span className="text-[10px] text-tertiary">Qty</span>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl bg-surface-container-low border border-outline-variant/50 px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              disabled={!dirty}
              onClick={run(() =>
                update({
                  foodId: item._id,
                  price: Number(price) || 0,
                  quantity: Number(qty) || 0,
                })
              )}
              className="self-end h-9 px-3 rounded-xl bg-primary text-on-primary text-sm disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Availability segmented control */}
      <div className="flex gap-1 px-sm">
        {AVAIL.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={run(() => setAvailability({ foodId: item._id, availability: a.key }))}
            className={`flex-1 py-1.5 rounded-full font-label-sm transition-colors ${
              item.availability === a.key
                ? "bg-on-surface text-surface"
                : "bg-surface-container-low text-tertiary"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-sm py-sm">
        {item.status === "draft" ? (
          <button
            type="button"
            onClick={run(() => publish({ foodId: item._id }))}
            className="flex-1 bg-secondary text-on-secondary font-label-md py-2 rounded-full flex items-center justify-center gap-1"
          >
            <Icon name="publish" className="text-lg" /> Publish
          </button>
        ) : item.status === "published" ? (
          <button
            type="button"
            onClick={run(() => setStatus({ foodId: item._id, status: "archived" }))}
            className="flex-1 border border-outline-variant text-on-surface-variant font-label-md py-2 rounded-full flex items-center justify-center gap-1"
          >
            <Icon name="archive" className="text-lg" /> Archive
          </button>
        ) : (
          <button
            type="button"
            onClick={run(() => setStatus({ foodId: item._id, status: "draft" }))}
            className="flex-1 border border-outline-variant text-on-surface-variant font-label-md py-2 rounded-full flex items-center justify-center gap-1"
          >
            <Icon name="unarchive" className="text-lg" /> Restore
          </button>
        )}
        <button
          type="button"
          onClick={run(() => remove({ foodId: item._id }))}
          aria-label="Delete"
          className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center"
        >
          <Icon name="delete" className="text-lg" />
        </button>
      </div>
      {err ? <p className="text-error font-label-sm px-sm pb-sm">{err}</p> : null}
    </article>
  );
}
