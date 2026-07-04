"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const items = [
  { label: "Deliveries", icon: "two_wheeler", href: "/rider" },
  { label: "Home", icon: "home", href: "/" },
  { label: "Account", icon: "person", href: "/settings" },
];

export default function RiderNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-4 pb-2 bg-on-surface text-surface shadow-[0px_-4px_20px_rgba(0,0,0,0.12)]">
      {items.map((item) => {
        const active = item.href === "/rider" ? pathname === "/rider" : pathname.startsWith(item.href);
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
