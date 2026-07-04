"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import Icon from "@/components/Icon";

type SubStatus = NonNullable<
  FunctionReturnType<typeof api.subscriptions.myStatus>
>;

export default function SubscriptionPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const status = useQuery(
    api.subscriptions.myStatus,
    isAuthenticated ? {} : "skip"
  );

  if (isLoading) return null;

  return (
    <main className="min-h-screen pb-24">
      <header className="px-margin-mobile pt-base">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-tertiary mb-md"
        >
          <Icon name="arrow_back" /> Back
        </button>
        <h1 className="font-headline-md text-on-surface text-[24px]">
          Subscription
        </h1>
      </header>

      <div className="px-margin-mobile mt-md">
        {!isAuthenticated || status === null ? (
          <Empty />
        ) : status === undefined ? (
          <div className="h-40 rounded-3xl bg-surface-container-low animate-pulse" />
        ) : (
          <StatusBody status={status} />
        )}
      </div>
    </main>
  );
}

function Empty() {
  return (
    <div className="text-center pt-16">
      <div className="w-20 h-20 mx-auto rounded-full bg-surface-container-high flex items-center justify-center mb-md">
        <Icon name="workspace_premium" className="text-4xl text-tertiary" />
      </div>
      <h2 className="font-headline-md text-on-surface mb-xs">No plan yet</h2>
      <p className="text-tertiary max-w-[260px] mx-auto mb-lg">
        Subscribe to start selling food on Kibanda Express.
      </p>
      <Link
        href="/become-seller"
        className="bg-primary text-on-primary font-label-md px-md py-3 rounded-full active:scale-95 transition-transform"
      >
        Become a Seller
      </Link>
    </div>
  );
}

function StatusBody({ status }: { status: SubStatus }) {
  const pay = status.payment;
  const active = status.active;

  // Awaiting M-Pesa: pending payment, reactive — flips automatically on callback.
  if (!active && pay && pay.status === "pending") {
    return (
      <Panel tone="wait" icon="hourglass_top" title="Waiting for M-Pesa…">
        <p>
          Check your phone and enter your M-Pesa PIN to pay for the{" "}
          <b>{status.planName}</b> plan. This screen updates automatically once
          the payment is confirmed.
        </p>
      </Panel>
    );
  }

  if (!active && pay && pay.status === "unconfigured") {
    return (
      <Panel tone="warn" icon="build" title="Payment not configured yet">
        <p>
          Your request was saved, but M-Pesa isn’t connected on this deployment.
          An admin needs to add the Daraja credentials, after which you can pay
          and activate the <b>{status.planName}</b> plan.
        </p>
      </Panel>
    );
  }

  if (!active && pay && pay.status === "failed") {
    return (
      <Panel tone="error" icon="error" title="Payment didn’t go through">
        <p>{pay.resultDesc || "The M-Pesa payment failed or was cancelled."}</p>
        <Link href="/become-seller" className="mt-md inline-block bg-primary text-on-primary font-label-md px-md py-2.5 rounded-full">
          Try again
        </Link>
      </Panel>
    );
  }

  if (active) {
    return (
      <Panel tone="ok" icon="verified" title="Subscription active">
        <p className="capitalize">
          {status.planName} · {status.daysLeft} day
          {status.daysLeft === 1 ? "" : "s"} remaining
        </p>
        {status.expiringSoon ? (
          <p className="mt-2 font-label-md text-on-secondary-container bg-secondary-container rounded-xl px-3 py-2">
            Expiring soon — renew to avoid your shop going read-only.
          </p>
        ) : null}
        {pay?.mpesaReceipt ? (
          <p className="font-label-sm opacity-80 mt-2">
            Last payment: {pay.mpesaReceipt}
          </p>
        ) : null}
        <div className="flex gap-sm mt-md">
          <Link href="/seller" className="flex-1 text-center bg-primary text-on-primary font-label-md py-2.5 rounded-full">
            Go to dashboard
          </Link>
          <Link href="/become-seller" className="flex-1 text-center border border-primary text-primary font-label-md py-2.5 rounded-full">
            Renew / change
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <Panel tone="warn" icon="info" title="Subscription inactive">
      <p>Your plan isn’t active. Subscribe again to keep selling.</p>
      <Link href="/become-seller" className="mt-md inline-block bg-primary text-on-primary font-label-md px-md py-2.5 rounded-full">
        Choose a plan
      </Link>
    </Panel>
  );
}

function Panel({
  tone,
  icon,
  title,
  children,
}: {
  tone: "ok" | "wait" | "warn" | "error";
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  const toneClass = {
    ok: "bg-primary-fixed text-on-primary-fixed",
    wait: "bg-secondary-container text-on-secondary-container",
    warn: "bg-surface-container-high text-on-surface",
    error: "bg-error-container text-on-error-container",
  }[tone];
  return (
    <div className={`rounded-3xl p-lg ${toneClass}`}>
      <Icon
        name={icon}
        fill
        className={`text-4xl mb-sm ${tone === "wait" ? "animate-pulse" : ""}`}
      />
      <h2 className="font-headline-md text-[20px] mb-xs">{title}</h2>
      <div className="font-body-md">{children}</div>
    </div>
  );
}
