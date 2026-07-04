"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import PageHeader from "./PageHeader";

function summarise(lines: Doc<"cartLines">[]) {
  const items = lines.reduce((n, l) => n + l.qty, 0);
  if (items === 0) return "Your basket is empty";

  const vendors = lines
    .map((l) => l.vendor)
    .filter((name, i, all) => all.indexOf(name) === i);
  const itemLabel = `${items} item${items === 1 ? "" : "s"}`;

  const [first, ...rest] = vendors;
  const vendorLabel =
    rest.length === 0 ? first : `${first} & ${rest.length} more`;

  return `${itemLabel} · ${vendorLabel}`;
}

export default function CartHeader() {
  const lines = useQuery(api.cart.list);

  return (
    <PageHeader
      title="Your Cart"
      subtitle={lines ? summarise(lines) : undefined}
    />
  );
}
