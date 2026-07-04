"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

// `npx convex dev` writes NEXT_PUBLIC_CONVEX_URL into .env.local. Until then we
// render children without the provider so the app still builds and runs.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!convex) return <>{children}</>;
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
