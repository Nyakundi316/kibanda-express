"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthPanel from "./AuthPanel";
import Icon from "./Icon";

type Role = "customer" | "seller" | "rider" | "admin";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-margin-mobile pt-24 flex flex-col items-center text-center">
      {children}
    </div>
  );
}

/**
 * Client-side gate. The server already enforces real RBAC on every mutation —
 * this just keeps users out of UIs they can't use and nudges them to the right
 * place (sign in, or become a seller).
 */
export default function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const me = useQuery(api.profiles.me);

  if (me === undefined) {
    return (
      <Centered>
        <Icon name="progress_activity" className="text-4xl text-primary animate-spin" />
      </Centered>
    );
  }

  if (me === null) {
    return <AuthPanel heading="Sign in to continue" />;
  }

  if (!roles.includes(me.role as Role)) {
    const wantsSeller = roles.includes("seller");
    return (
      <Centered>
        <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-md">
          <Icon name="lock" className="text-4xl text-tertiary" />
        </div>
        <h2 className="font-headline-md text-on-surface mb-xs">
          {wantsSeller ? "Sellers only" : "Restricted area"}
        </h2>
        <p className="text-tertiary max-w-[260px] mb-lg">
          {wantsSeller
            ? "You need an active seller subscription to open this dashboard."
            : "Your account doesn’t have access to this area."}
        </p>
        {wantsSeller ? (
          <Link
            href="/become-seller"
            className="bg-primary text-on-primary font-label-md px-md py-3 rounded-full active:scale-95 transition-transform"
          >
            Become a Seller
          </Link>
        ) : (
          <Link href="/" className="text-primary font-label-md">
            Back to home
          </Link>
        )}
      </Centered>
    );
  }

  return <>{children}</>;
}
