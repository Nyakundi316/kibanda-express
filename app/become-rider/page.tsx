"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { humanize } from "@/lib/errors";
import AuthPanel from "@/components/AuthPanel";
import Icon from "@/components/Icon";

const VEHICLES = [
  { key: "motorbike", label: "Motorbike", icon: "two_wheeler" },
  { key: "bicycle", label: "Bicycle", icon: "pedal_bike" },
  { key: "car", label: "Car", icon: "directions_car" },
  { key: "on_foot", label: "On foot", icon: "directions_walk" },
] as const;

export default function BecomeRiderPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const application = useQuery(api.riders.myRiderProfile, isAuthenticated ? {} : "skip");
  const apply = useMutation(api.riders.apply);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState<(typeof VEHICLES)[number]["key"]>("motorbike");
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return null;
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen pb-24">
        <AuthPanel heading="Sign in to become a rider" />
      </main>
    );
  }

  // Already an approved rider → straight to the dashboard.
  if (me?.role === "rider") {
    return (
      <Centered>
        <Done icon="verified" title="You're a rider">
          Your rider account is active.
        </Done>
        <Link href="/rider" className="bg-primary text-on-primary font-label-md px-md py-3 rounded-full">
          Open rider dashboard
        </Link>
      </Centered>
    );
  }

  // Applied, awaiting admin approval.
  if (application && application.verification === "pending") {
    return (
      <Centered>
        <Done icon="hourglass_top" title="Application received">
          Thanks {application.name}! An admin will review your details shortly. You’ll
          be notified once you’re approved.
        </Done>
        <Link href="/" className="text-primary font-label-md">Back to home</Link>
      </Centered>
    );
  }

  if (application && application.verification === "rejected") {
    return (
      <Centered>
        <Done icon="info" title="Application not approved">
          Your rider application wasn’t approved. Contact support if you think this is
          a mistake.
        </Done>
        <Link href="/" className="text-primary font-label-md">Back to home</Link>
      </Centered>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apply({ name, phone, vehicleType, vehiclePlate: plate || undefined });
      router.refresh();
    } catch (err) {
      setError(humanize(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen pb-32">
      <header className="px-margin-mobile pt-base">
        <Link href="/" className="flex items-center gap-1 text-tertiary mb-md">
          <Icon name="arrow_back" /> Back
        </Link>
        <h1 className="font-headline-md text-on-surface text-[24px]">Become a rider</h1>
        <p className="text-tertiary font-label-sm mt-1">
          Deliver orders around your area and earn. Get approved by our team to start.
        </p>
      </header>

      <section className="px-margin-mobile mt-md flex flex-col gap-sm">
        <Field label="Full name" value={name} onChange={setName} placeholder="John Otieno" />
        <Field label="Phone (M-Pesa)" value={phone} onChange={setPhone} placeholder="0712345678" tel />

        <div>
          <span className="font-label-sm text-tertiary">Vehicle</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {VEHICLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setVehicleType(v.key)}
                className={`flex items-center gap-2 rounded-2xl px-3 py-3 border-2 transition-colors ${
                  vehicleType === v.key ? "border-primary bg-primary-fixed/40" : "border-transparent bg-surface smooth-shadow"
                }`}
              >
                <Icon name={v.icon} className="text-xl text-primary" /> {v.label}
              </button>
            ))}
          </div>
        </div>

        {vehicleType === "motorbike" || vehicleType === "car" ? (
          <Field label="Number plate" value={plate} onChange={setPlate} placeholder="KMF 123A" />
        ) : null}
      </section>

      {error ? (
        <p className="px-margin-mobile mt-sm text-error font-label-sm flex items-center gap-1">
          <Icon name="error" className="text-base" /> {error}
        </p>
      ) : null}

      <div className="px-margin-mobile mt-lg">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !name || !phone}
          className="w-full bg-primary text-on-primary font-label-md text-[16px] py-4 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {busy ? <Icon name="progress_activity" className="animate-spin" /> : <Icon name="how_to_reg" />}
          Submit application
        </button>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-margin-mobile pt-24 flex flex-col items-center text-center gap-md">
      {children}
    </main>
  );
}

function Done({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center">
        <Icon name={icon} className="text-4xl text-primary" />
      </div>
      <h2 className="font-headline-md text-on-surface">{title}</h2>
      <p className="text-tertiary max-w-[280px]">{children}</p>
    </>
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
