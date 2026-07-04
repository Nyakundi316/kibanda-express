"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import Icon from "./Icon";

export default function AccountActions() {
  const me = useQuery(api.profiles.me);
  const { signOut } = useAuthActions();

  if (me === undefined) {
    return (
      <section className="px-margin-mobile mt-md">
        <div className="h-20 rounded-3xl bg-surface-container-low animate-pulse" />
      </section>
    );
  }

  // Signed out → invite to sign in.
  if (me === null) {
    return (
      <section className="px-margin-mobile mt-md">
        <Link
          href="/signin"
          className="flex items-center gap-sm bg-surface rounded-3xl smooth-shadow p-md active:bg-surface-container-low transition-colors"
        >
          <span className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center">
            <Icon name="login" className="text-2xl" />
          </span>
          <span className="flex-grow">
            <span className="font-label-md text-on-surface block">Sign in or register</span>
            <span className="font-label-sm text-tertiary">Order food or start selling</span>
          </span>
          <Icon name="chevron_right" className="text-tertiary" />
        </Link>
      </section>
    );
  }

  const isSeller = me.role === "seller" || me.role === "admin";

  return (
    <section className="px-margin-mobile mt-md space-y-sm">
      {/* Become a seller (customers) */}
      {me.role === "customer" ? (
        <Link
          href="/become-seller"
          className="flex items-center gap-sm bg-primary text-on-primary rounded-3xl p-md active:scale-[0.99] transition-transform"
        >
          <Icon name="storefront" className="text-3xl" />
          <span className="flex-grow">
            <span className="font-label-md block">Become a Seller</span>
            <span className="font-label-sm text-on-primary/80">
              Sell your food, get paid via M-Pesa
            </span>
          </span>
          <Icon name="arrow_forward" />
        </Link>
      ) : null}

      {/* Seller shortcuts */}
      {isSeller ? (
        <div className="grid grid-cols-2 gap-sm">
          <Link href="/seller" className="bg-surface smooth-shadow rounded-2xl p-sm flex flex-col items-center gap-1 active:bg-surface-container-low">
            <Icon name="dashboard" className="text-2xl text-primary" />
            <span className="font-label-sm">Dashboard</span>
          </Link>
          <Link href="/subscription" className="bg-surface smooth-shadow rounded-2xl p-sm flex flex-col items-center gap-1 active:bg-surface-container-low">
            <Icon name="workspace_premium" className="text-2xl text-primary" />
            <span className="font-label-sm">Subscription</span>
          </Link>
        </div>
      ) : null}

      {/* Admin */}
      {me.role === "admin" ? (
        <Link href="/admin" className="flex items-center gap-sm bg-on-surface text-surface rounded-3xl p-md">
          <Icon name="admin_panel_settings" className="text-2xl text-secondary" />
          <span className="flex-grow font-label-md">Admin console</span>
          <Icon name="chevron_right" />
        </Link>
      ) : null}

      {/* Identity + sign out */}
      <div className="flex items-center justify-between bg-surface-container-low rounded-2xl px-md py-3">
        <div className="min-w-0">
          <p className="font-label-sm text-tertiary capitalize">{me.role} account</p>
          <p className="font-label-md text-on-surface truncate">{me.email ?? "Signed in"}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1 text-error font-label-md"
        >
          <Icon name="logout" className="text-lg" /> Sign out
        </button>
      </div>
    </section>
  );
}
