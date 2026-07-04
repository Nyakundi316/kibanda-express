"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { categories } from "@/lib/data";
import { humanize } from "@/lib/errors";
import Icon from "@/components/Icon";

const FULFILMENT = ["delivery", "pickup"] as const;

export default function ShopPage() {
  const shop = useQuery(api.shops.myShop);
  const create = useMutation(api.shops.create);
  const update = useMutation(api.shops.update);
  const setActive = useMutation(api.shops.setActive);

  const [form, setForm] = useState({
    name: "",
    description: "",
    logo: "",
    banner: "",
    location: "",
    phone: "",
    whatsapp: "",
    openHour: "08:00",
    closeHour: "21:00",
  });
  const [fulfilment, setFulfilment] = useState<string[]>(["delivery", "pickup"]);
  const [cats, setCats] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Hydrate the form when an existing shop loads.
  useEffect(() => {
    if (shop) {
      setForm({
        name: shop.name,
        description: shop.description ?? "",
        logo: shop.logo ?? "",
        banner: shop.banner ?? "",
        location: shop.location,
        phone: shop.phone,
        whatsapp: shop.whatsapp ?? "",
        openHour: shop.openHour ?? "08:00",
        closeHour: shop.closeHour ?? "21:00",
      });
      setFulfilment(shop.fulfilment);
      setCats(shop.categories);
    }
  }, [shop]);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggle = (list: string[], setList: (x: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const payload = {
      name: form.name,
      description: form.description || undefined,
      logo: form.logo || undefined,
      banner: form.banner || undefined,
      location: form.location,
      phone: form.phone,
      whatsapp: form.whatsapp || undefined,
      openHour: form.openHour || undefined,
      closeHour: form.closeHour || undefined,
      fulfilment,
      categories: cats,
    };
    try {
      if (shop) await update({ shopId: shop._id, ...payload });
      else await create(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(humanize(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen">
      <header className="px-margin-mobile pt-base pb-sm flex items-center justify-between">
        <div>
          <h1 className="font-headline-md text-on-surface text-[24px]">
            {shop ? "Edit shop" : "Create your shop"}
          </h1>
          <p className="text-tertiary font-label-sm">
            This is what customers see in the marketplace.
          </p>
        </div>
        {shop ? (
          <button
            type="button"
            onClick={() => setActive({ shopId: shop._id, active: !shop.active })}
            className={`flex items-center gap-1 font-label-sm px-3 py-1.5 rounded-full ${
              shop.active
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container-high text-tertiary"
            }`}
          >
            <Icon name={shop.active ? "toggle_on" : "toggle_off"} className="text-xl" />
            {shop.active ? "Open" : "Closed"}
          </button>
        ) : null}
      </header>

      {form.banner ? (
        <div
          className="mx-margin-mobile h-28 rounded-3xl bg-cover bg-center mb-md"
          style={{ backgroundImage: `url('${form.banner}')` }}
        />
      ) : null}

      <section className="px-margin-mobile flex flex-col gap-sm">
        <Input label="Shop name" value={form.name} onChange={set("name")} placeholder="Mama Njeri's Kitchen" />
        <Textarea label="Short description" value={form.description} onChange={set("description")} placeholder="Home-style Kenyan meals, cooked fresh daily." />
        <Input label="Logo image URL" value={form.logo} onChange={set("logo")} placeholder="https://…" />
        <Input label="Banner image URL" value={form.banner} onChange={set("banner")} placeholder="https://…" />
        <Input label="Location" value={form.location} onChange={set("location")} placeholder="Westlands, Nairobi" />
        <div className="grid grid-cols-2 gap-sm">
          <Input label="Phone" value={form.phone} onChange={set("phone")} placeholder="0712345678" />
          <Input label="WhatsApp" value={form.whatsapp} onChange={set("whatsapp")} placeholder="0712345678" />
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <Input label="Opens" value={form.openHour} onChange={set("openHour")} placeholder="08:00" />
          <Input label="Closes" value={form.closeHour} onChange={set("closeHour")} placeholder="21:00" />
        </div>

        <div>
          <span className="font-label-sm text-tertiary">Fulfilment</span>
          <div className="flex gap-2 mt-1">
            {FULFILMENT.map((f) => (
              <Chip key={f} active={fulfilment.includes(f)} onClick={() => toggle(fulfilment, setFulfilment, f)} label={f} />
            ))}
          </div>
        </div>

        <div>
          <span className="font-label-sm text-tertiary">Food categories</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {categories.map((c) => (
              <Chip key={c.label} active={cats.includes(c.label)} onClick={() => toggle(cats, setCats, c.label)} label={c.label} />
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <p className="px-margin-mobile mt-sm text-error font-label-sm flex items-center gap-1">
          <Icon name="error" className="text-base" />
          {error}
        </p>
      ) : null}

      <div className="px-margin-mobile mt-lg pb-8">
        <button
          type="button"
          onClick={save}
          disabled={busy || !form.name || !form.location || !form.phone}
          className="w-full bg-primary text-on-primary font-label-md text-[16px] py-4 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {busy ? (
            <Icon name="progress_activity" className="text-xl animate-spin" />
          ) : (
            <Icon name={saved ? "check" : "save"} className="text-xl" />
          )}
          {saved ? "Saved" : shop ? "Save changes" : "Create shop"}
        </button>
      </div>
    </main>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="font-label-sm text-tertiary">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary"
      />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="font-label-sm text-tertiary">{label}</span>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary resize-none"
      />
    </label>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full font-label-sm capitalize transition-colors ${
        active ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      {label}
    </button>
  );
}
