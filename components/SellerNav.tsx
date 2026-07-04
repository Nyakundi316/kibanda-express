"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const items = [
  { label: "Dashboard", icon: "dashboard", href: "/seller" },
  { label: "Orders", icon: "receipt_long", href: "/seller/orders" },
  { label: "Menu", icon: "restaurant_menu", href: "/seller/menu" },
  { label: "Shop", icon: "storefront", href: "/seller/shop" },
  { label: "Plan", icon: "workspace_premium", href: "/subscription" },
];

export default function SellerNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-2 pb-2 bg-on-surface text-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.12)]">
      {items.map((item) => {
        const active =
          item.href === "/seller"
            ? pathname === "/seller"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center pt-2.5 pb-1 active:scale-95 transition-transform ${
              active ? "text-secondary" : "text-surface/60"
            }`}
          >
            <Icon name={item.icon} fill={active} />
            <span className="font-label-sm text-[11px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
