"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import AuthPanel from "@/components/AuthPanel";
import Icon from "@/components/Icon";

export default function SignInPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/profile");
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen pb-24">
      <button
        type="button"
        onClick={() => router.back()}
        className="px-margin-mobile pt-base flex items-center gap-1 text-tertiary"
      >
        <Icon name="arrow_back" /> Back
      </button>
      {isLoading ? null : <AuthPanel />}
    </main>
  );
}
