"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { humanize } from "@/lib/errors";
import Icon from "./Icon";

export default function AuthPanel({
  heading = "Sign in to continue",
  subtitle = "One account for ordering and selling on Kibanda Express.",
}: {
  heading?: string;
  subtitle?: string;
}) {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const ensureProfile = useMutation(api.profiles.ensureProfile);
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Backstop for accounts that predate the afterUserCreatedOrUpdated callback.
  // Runs only once the Convex connection is actually authenticated — calling
  // it straight after signIn() races the token handshake and throws
  // "Not authenticated" even though the sign-in succeeded.
  useEffect(() => {
    if (isAuthenticated) ensureProfile().catch(() => {});
  }, [isAuthenticated, ensureProfile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow });
    } catch (err) {
      setError(humanize(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-margin-mobile pt-lg">
      <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center mb-md">
        <Icon name="storefront" className="text-3xl" />
      </div>
      <h1 className="font-headline-md text-on-surface text-[24px]">{heading}</h1>
      <p className="text-tertiary font-body-md mt-1 mb-lg">{subtitle}</p>

      <div className="flex gap-2 bg-surface-container-low p-1 rounded-full w-full mb-md">
        {(["signIn", "signUp"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFlow(f);
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-full font-label-md transition-colors ${
              flow === f ? "bg-surface text-primary shadow-sm" : "text-tertiary"
            }`}
          >
            {f === "signIn" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-sm">
        <label className="block">
          <span className="font-label-sm text-tertiary">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-1 w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="font-label-sm text-tertiary">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
            placeholder="At least 8 characters"
            className="mt-1 w-full rounded-2xl bg-surface-container-low border border-outline-variant/50 px-4 py-3 focus:outline-none focus:border-primary"
          />
        </label>

        {error ? (
          <p className="text-error font-label-sm flex items-center gap-1">
            <Icon name="error" className="text-base" />
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-sm w-full bg-primary text-on-primary font-label-md text-[16px] py-3.5 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {busy ? (
            <Icon name="progress_activity" className="text-xl animate-spin" />
          ) : (
            <Icon name={flow === "signIn" ? "login" : "person_add"} className="text-xl" />
          )}
          {flow === "signIn" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
