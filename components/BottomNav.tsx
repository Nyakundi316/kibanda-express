"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Icon from "./Icon";

const CIRCLE =
  "relative h-12 w-12 rounded-full bg-white border border-black/5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-95 transition-transform";

// Floating icon nav — soft white circles plus a wider Search pill in the
// middle. Orders moved out of the bar; it stays reachable from Profile and
// from the post-checkout redirect.
export default function BottomNav() {
  const pathname = usePathname();
  const cartCount = useQuery(api.cart.count) ?? 0;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2"
    >
      <NavCircle href="/" icon="home" label="Home" active={isActive("/")} />
      <NavCircle
        href="/market"
        icon="location_on"
        label="Market"
        active={isActive("/market")}
      />

      <Link
        href="/market"
        aria-label="Search meals or kibandas"
        className="h-12 px-5 min-w-[120px] rounded-full bg-white border border-black/5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Icon name="search" className="nav-icon text-[22px] text-on-surface" />
        <span className="font-label-md text-on-surface">Search</span>
      </Link>

      <NavCircle
        href="/cart"
        icon="shopping_cart"
        label="Cart"
        active={isActive("/cart")}
        badge={cartCount > 0 ? cartCount : null}
      />
      <NavCircle
        href="/profile"
        icon="person"
        label="Profile"
        active={isActive("/profile")}
      />
    </nav>
  );
}

function NavCircle({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number | null;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={CIRCLE}
    >
      <Icon name={icon} className="nav-icon text-[22px] text-on-surface" />
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 bg-primary text-on-primary text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-bold tabular-nums">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
      {active ? (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-on-surface" />
      ) : null}
    </Link>
  );
}
