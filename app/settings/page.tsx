"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { humanize } from "@/lib/errors";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import AuthPanel from "@/components/AuthPanel";
import Icon from "@/components/Icon";

export default function SettingsPage() {
  const me = useQuery(api.profiles.me);
  const updateMe = useMutation(api.profiles.updateMe);
  const { signOut } = useAuthActions();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Hydrate the form once the profile loads.
  useEffect(() => {
    if (me) {
      setDisplayName(me.name ?? "");
    }
  }, [me]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateMe({
        displayName: displayName || undefined,
        phone: phone || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(humanize(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <PageHeader title="Settings" subtitle="Account & preferences" />
      <main className="pb-32">
        {me === undefined ? (
          <div className="px-margin-mobile pt-md">
            <div className="h-40 rounded-3xl bg-surface-container-low animate-pulse" />
          </div>
        ) : me === null ? (
          <AuthPanel
            heading="Sign in to manage settings"
            subtitle="Update your details, preferences and account."
          />
        ) : (
          <>
            {/* Account details */}
            <section className="px-margin-mobile pt-md">
              <h2 className="font-label-sm text-tertiary uppercase tracking-wider mb-sm">
                Account
              </h2>
              <div className="bg-surface rounded-3xl smooth-shadow p-md flex flex-col gap-sm">
                <div className="flex items-center gap-sm pb-sm border-b border-outline-variant/40">
                  <span className="w-11 h-11 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center">
                    <Icon name="mail" className="text-xl" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-label-sm text-tertiary">Signed in as</p>
                    <p className="font-label-md text-on-surface truncate">
                      {me.email ?? "—"}
                    </p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-tertiary capitalize">
                    {me.role}
                  </span>
                </div>

                <label className="block">
                  <span className="font-label-sm text-tertiary">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    className="mt-1 w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="font-label-sm text-tertiary">Phone</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="0712345678"
                    className="mt-1 w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary"
                  />
                </label>

                {error ? (
                  <p className="text-error font-label-sm flex items-center gap-1">
                    <Icon name="error" className="text-base" /> {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="mt-1 w-full bg-primary text-on-primary font-label-md py-3 rounded-full flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
                >
                  <Icon
                    name={busy ? "progress_activity" : saved ? "check" : "save"}
                    className={busy ? "animate-spin" : ""}
                  />
                  {saved ? "Saved" : "Save changes"}
                </button>
              </div>
            </section>

            {/* Preferences */}
            <section className="px-margin-mobile mt-lg">
              <h2 className="font-label-sm text-tertiary uppercase tracking-wider mb-sm">
                Preferences
              </h2>
              <div className="bg-surface rounded-3xl smooth-shadow divide-y divide-outline-variant/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setNotify((n) => !n)}
                  className="w-full flex items-center gap-sm px-sm py-3.5 text-left"
                >
                  <span className="w-10 h-10 rounded-2xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
                    <Icon name="notifications" className="text-xl" />
                  </span>
                  <span className="flex-grow font-label-md text-on-surface">
                    Order notifications
                  </span>
                  <Icon
                    name={notify ? "toggle_on" : "toggle_off"}
                    className={`text-3xl ${notify ? "text-primary" : "text-tertiary"}`}
                  />
                </button>
                <Link
                  href="/orders"
                  className="w-full flex items-center gap-sm px-sm py-3.5 active:bg-surface-container-low transition-colors"
                >
                  <span className="w-10 h-10 rounded-2xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
                    <Icon name="receipt_long" className="text-xl" />
                  </span>
                  <span className="flex-grow font-label-md text-on-surface">
                    Order history
                  </span>
                  <Icon name="chevron_right" className="text-tertiary text-xl" />
                </Link>
              </div>
            </section>

            {/* Rider shortcuts */}
            {me.role === "rider" || me.role === "admin" ? (
              <section className="px-margin-mobile mt-lg">
                <h2 className="font-label-sm text-tertiary uppercase tracking-wider mb-sm">Riding</h2>
                <div className="bg-surface rounded-3xl smooth-shadow divide-y divide-outline-variant/40 overflow-hidden">
                  <SettingLink href="/rider" icon="two_wheeler" label="Rider dashboard" />
                </div>
              </section>
            ) : null}

            {/* Seller / admin shortcuts */}
            {me.role === "seller" || me.role === "admin" ? (
              <section className="px-margin-mobile mt-lg">
                <h2 className="font-label-sm text-tertiary uppercase tracking-wider mb-sm">
                  {me.role === "admin" ? "Admin" : "Selling"}
                </h2>
                <div className="bg-surface rounded-3xl smooth-shadow divide-y divide-outline-variant/40 overflow-hidden">
                  <SettingLink href="/seller" icon="dashboard" label="Seller dashboard" />
                  <SettingLink href="/subscription" icon="workspace_premium" label="Subscription" />
                  {me.role === "admin" ? (
                    <SettingLink href="/admin" icon="admin_panel_settings" label="Admin console" />
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* Earn with us — entry points for customers */}
            {me.role === "customer" ? (
              <section className="px-margin-mobile mt-lg">
                <h2 className="font-label-sm text-tertiary uppercase tracking-wider mb-sm">Earn with us</h2>
                <div className="bg-surface rounded-3xl smooth-shadow divide-y divide-outline-variant/40 overflow-hidden">
                  <SettingLink href="/become-seller" icon="storefront" label="Become a seller" />
                  <SettingLink href="/become-rider" icon="two_wheeler" label="Become a rider" />
                </div>
              </section>
            ) : null}

            {/* Sign out */}
            <section className="px-margin-mobile mt-lg">
              <button
                type="button"
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 bg-error-container text-on-error-container font-label-md py-3.5 rounded-3xl active:scale-[0.99] transition-transform"
              >
                <Icon name="logout" className="text-xl" />
                Sign out
              </button>
            </section>

            <p className="text-center text-tertiary font-label-sm mt-lg">
              Kibanda Express · v0.1.0
            </p>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function SettingLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="w-full flex items-center gap-sm px-sm py-3.5 active:bg-surface-container-low transition-colors"
    >
      <span className="w-10 h-10 rounded-2xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
        <Icon name={icon} className="text-xl" />
      </span>
      <span className="flex-grow font-label-md text-on-surface">{label}</span>
      <Icon name="chevron_right" className="text-tertiary text-xl" />
    </Link>
  );
}
