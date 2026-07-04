"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ksh } from "@/lib/format";
import { humanize } from "@/lib/errors";
import AuthPanel from "@/components/AuthPanel";
import Icon from "@/components/Icon";

export default function BecomeSellerPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const plans = useQuery(api.plans.list);
  const start = useMutation(api.subscriptions.start);

  const [planKey, setPlanKey] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return null;
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pb-24">
        <AuthPanel
          heading="Create your seller account"
          subtitle="Sign in or register, then choose a selling plan."
        />
      </main>
    );
  }

  const selected = plans?.find((p) => p.key === planKey) ?? null;

  const pay = async () => {
    if (!planKey) {
      setError("Choose a plan first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await start({
        planKey,
        phone,
        businessName,
        ownerName,
        location,
        whatsapp: whatsapp || undefined,
        idNumber: idNumber || undefined,
      });
      router.push("/subscription");
    } catch (err) {
      setError(humanize(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen pb-32">
      <header className="px-margin-mobile pt-base">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-tertiary mb-md"
        >
          <Icon name="arrow_back" /> Back
        </button>
        <h1 className="font-headline-md text-on-surface text-[26px]">
          Become a Seller
        </h1>
        <p className="text-tertiary mt-1">
          Pick a plan, pay with M-Pesa, and your shop goes live the moment the
          payment is confirmed.
        </p>
      </header>

      {/* Plans */}
      <section className="px-margin-mobile mt-md flex flex-col gap-sm">
        {plans === undefined
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-3xl bg-surface-container-low animate-pulse" />
            ))
          : plans.map((plan) => {
              const active = plan.key === planKey;
              return (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => setPlanKey(plan.key)}
                  className={`text-left rounded-3xl p-md border-2 transition-colors ${
                    active
                      ? "border-primary bg-primary-fixed/40"
                      : "border-transparent bg-surface smooth-shadow"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-headline-md text-on-surface text-[18px]">
                          {plan.name}
                        </h3>
                        {plan.premium ? (
                          <span className="bg-secondary text-on-secondary text-[10px] font-bold px-2 py-0.5 rounded-full">
                            PREMIUM
                          </span>
                        ) : null}
                      </div>
                      <p className="font-label-sm text-tertiary mt-0.5">
                        {ksh(plan.price)} ·{" "}
                        {plan.durationDays === 1
                          ? "per day"
                          : plan.durationDays === 30
                          ? "per month"
                          : "per year"}
                      </p>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        active ? "border-primary bg-primary text-on-primary" : "border-outline-variant"
                      }`}
                    >
                      {active ? <Icon name="check" className="text-base" /> : null}
                    </span>
                  </div>
                  <ul className="mt-sm grid grid-cols-1 gap-1">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-center gap-2 font-label-sm text-on-surface-variant">
                        <Icon name="check_circle" fill className="text-base text-secondary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
      </section>

      {/* Business details */}
      <section className="px-margin-mobile mt-lg">
        <h2 className="font-headline-md text-on-surface text-[18px] mb-sm">
          Business details
        </h2>
        <div className="flex flex-col gap-sm">
          <Field label="Shop / business name" value={businessName} onChange={setBusinessName} placeholder="Mama Njeri's Kitchen" />
          <Field label="Your full name" value={ownerName} onChange={setOwnerName} placeholder="Jane Njeri" />
          <Field label="Location" value={location} onChange={setLocation} placeholder="Westlands, Nairobi" />
          <Field label="M-Pesa phone (for payment)" value={phone} onChange={setPhone} placeholder="0712345678" inputMode="tel" />
          <Field label="WhatsApp (optional)" value={whatsapp} onChange={setWhatsapp} placeholder="0712345678" inputMode="tel" />
          <Field label="ID / passport no. (optional)" value={idNumber} onChange={setIdNumber} placeholder="For verification" />
        </div>
      </section>

      {error ? (
        <p className="px-margin-mobile mt-sm text-error font-label-sm flex items-center gap-1">
          <Icon name="error" className="text-base" />
          {error}
        </p>
      ) : null}

      <div className="px-margin-mobile mt-lg">
        <button
          type="button"
          onClick={pay}
          disabled={busy || !planKey || !businessName || !ownerName || !location || !phone}
          className="w-full bg-primary text-on-primary font-label-md text-[16px] py-4 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {busy ? (
            <Icon name="progress_activity" className="text-xl animate-spin" />
          ) : (
            <Icon name="smartphone" className="text-xl" />
          )}
          {selected ? `Pay ${ksh(selected.price)} with M-Pesa` : "Pay with M-Pesa"}
        </button>
        <p className="text-center text-tertiary font-label-sm mt-2">
          You’ll get an M-Pesa prompt on your phone. Your plan activates only
          after the payment is confirmed.
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "tel";
}) {
  return (
    <label className="block">
      <span className="font-label-sm text-tertiary">{label}</span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary"
      />
    </label>
  );
}
