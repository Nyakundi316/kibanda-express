"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ksh } from "@/lib/format";
import { humanize } from "@/lib/errors";
import AuthPanel from "@/components/AuthPanel";
import Icon from "@/components/Icon";

const DELIVERY_FEE = 80;
const SERVICE_FEE = 25;

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const lines = useQuery(api.cart.list);
  const checkout = useMutation(api.marketplaceOrders.checkout);

  const [fulfilment, setFulfilment] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "cash">("mpesa");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading) return null;
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pb-24">
        <AuthPanel heading="Sign in to check out" subtitle="Your basket is waiting." />
      </main>
    );
  }

  const subtotal = (lines ?? []).reduce((s, l) => s + l.price * l.qty, 0);
  const deliveryFee = fulfilment === "delivery" ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee + SERVICE_FEE;
  const empty = lines !== undefined && lines.length === 0;

  const placeOrder = async () => {
    setBusy(true);
    setError(null);
    try {
      const orders = await checkout({
        fulfilment,
        paymentMethod,
        customerName: name,
        customerPhone: phone,
        address: fulfilment === "delivery" ? address : undefined,
        note: note || undefined,
      });
      const first = orders[0];
      router.push(`/orders?placed=${first?.reference ?? ""}`);
    } catch (err) {
      setError(humanize(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen pb-40">
      <header className="px-margin-mobile pt-base flex items-center gap-2">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="text-tertiary">
          <Icon name="arrow_back" />
        </button>
        <h1 className="font-headline-md text-on-surface text-[22px]">Checkout</h1>
      </header>

      {empty ? (
        <div className="px-margin-mobile pt-24 text-center">
          <Icon name="shopping_basket" className="text-5xl text-tertiary" />
          <p className="text-tertiary mt-sm mb-md">Your basket is empty.</p>
          <Link href="/market" className="bg-primary text-on-primary font-label-md px-md py-3 rounded-full">
            Browse food
          </Link>
        </div>
      ) : (
        <>
          {/* Fulfilment */}
          <section className="px-margin-mobile mt-md">
            <div className="flex gap-2 bg-surface-container-low p-1 rounded-full">
              {(["delivery", "pickup"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFulfilment(f)}
                  className={`flex-1 py-2.5 rounded-full font-label-md capitalize transition-colors ${
                    fulfilment === f ? "bg-surface text-primary shadow-sm" : "text-tertiary"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </section>

          {/* Where the food goes — address leads the whole flow */}
          <section className="px-margin-mobile mt-md">
            <h2 className="flex items-center gap-1 font-label-sm text-tertiary uppercase tracking-wider mb-sm">
              <Icon name="location_on" className="text-base" />
              {fulfilment === "delivery" ? "Deliver to" : "Pickup order"}
            </h2>
            <div className="bg-surface rounded-3xl smooth-shadow p-md flex flex-col gap-sm">
              {fulfilment === "delivery" ? (
                <Field label="Delivery address" value={address} onChange={setAddress} placeholder="House, street, area" />
              ) : (
                <p className="font-label-sm text-on-surface-variant">
                  You&rsquo;ll collect this order at the kibanda once it&rsquo;s ready.
                </p>
              )}
              <Field label="Note for the kitchen (optional)" value={note} onChange={setNote} placeholder="e.g. extra kachumbari" />
            </div>
          </section>

          {/* Contact */}
          <section className="px-margin-mobile mt-md">
            <h2 className="flex items-center gap-1 font-label-sm text-tertiary uppercase tracking-wider mb-sm">
              <Icon name="person" className="text-base" /> Contact
            </h2>
            <div className="bg-surface rounded-3xl smooth-shadow p-md flex flex-col gap-sm">
              <Field label="Your name" value={name} onChange={setName} placeholder="Jane Njeri" />
              <Field label="Phone (M-Pesa)" value={phone} onChange={setPhone} placeholder="0712345678" tel />
            </div>
          </section>

          {/* Payment */}
          <section className="px-margin-mobile mt-md">
            <h2 className="flex items-center gap-1 font-label-sm text-tertiary uppercase tracking-wider mb-sm">
              <Icon name="account_balance_wallet" className="text-base" /> Pay with
            </h2>
            <div className="bg-surface rounded-3xl smooth-shadow overflow-hidden divide-y divide-outline-variant/30">
              <PayOption
                active={paymentMethod === "mpesa"}
                onClick={() => setPaymentMethod("mpesa")}
                icon="smartphone"
                iconClass="bg-secondary-container text-on-secondary-container"
                title="M-Pesa"
                subtitle={
                  phone.trim()
                    ? `STK prompt will be sent to ${phone.trim()}`
                    : "You'll get an STK prompt on your phone"
                }
              />
              <PayOption
                active={paymentMethod === "cash"}
                onClick={() => setPaymentMethod("cash")}
                icon="payments"
                iconClass="bg-surface-container-high text-on-surface-variant"
                title="Cash"
                subtitle={
                  fulfilment === "delivery"
                    ? "Pay the rider when your food arrives"
                    : "Pay at the kibanda when you collect"
                }
              />
            </div>
          </section>

          {/* Summary */}
          <section className="px-margin-mobile mt-md">
            <div className="bg-surface-container-low rounded-3xl p-md">
              <Row label="Subtotal" value={ksh(subtotal)} />
              <Row label="Delivery fee" value={ksh(deliveryFee)} />
              <Row label="Service fee" value={ksh(SERVICE_FEE)} />
              <div className="border-t border-outline-variant/60 my-sm" />
              <div className="flex justify-between items-center">
                <span className="font-headline-md text-on-surface">Total</span>
                <span className="font-headline-md text-primary text-[22px] tabular-nums">{ksh(total)}</span>
              </div>
            </div>
          </section>

          {error ? (
            <p className="px-margin-mobile mt-sm text-error font-label-sm flex items-center gap-1">
              <Icon name="error" className="text-base" /> {error}
            </p>
          ) : null}

          <div className="fixed bottom-0 inset-x-0 bg-surface border-t border-outline-variant/40 px-margin-mobile py-3">
            <p className="flex justify-between font-label-sm text-tertiary mb-2">
              <span>
                Includes {ksh(SERVICE_FEE)} service fee
                {deliveryFee > 0 ? ` + ${ksh(deliveryFee)} delivery` : ""}
              </span>
              <span className="tabular-nums text-on-surface font-semibold">{ksh(total)}</span>
            </p>
            <button
              type="button"
              onClick={placeOrder}
              disabled={busy || !name || !phone || (fulfilment === "delivery" && !address)}
              className="w-full bg-primary text-on-primary font-label-md text-[16px] py-4 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {busy ? <Icon name="progress_activity" className="animate-spin" /> : <Icon name="check_circle" />}
              {paymentMethod === "mpesa" ? `Pay ${ksh(total)} with M-Pesa` : `Place order · ${ksh(total)}`}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function Field({ label, value, onChange, placeholder, tel }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; tel?: boolean }) {
  return (
    <label className="block">
      <span className="font-label-sm text-tertiary">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={tel ? "tel" : "text"}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary"
      />
    </label>
  );
}

function PayOption({
  active,
  onClick,
  icon,
  iconClass,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  iconClass: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full flex items-center gap-sm p-sm pr-md text-left transition-colors ${
        active ? "bg-primary-fixed/30" : ""
      }`}
    >
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon name={icon} className="text-xl" />
      </span>
      <span className="flex-grow min-w-0">
        <span className="font-label-md text-on-surface block">{title}</span>
        <span className="font-label-sm text-tertiary block truncate">{subtitle}</span>
      </span>
      <span
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          active ? "border-primary" : "border-outline-variant"
        }`}
      >
        {active ? <span className="w-2.5 h-2.5 rounded-full bg-primary" /> : null}
      </span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-on-surface-variant mb-2">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
