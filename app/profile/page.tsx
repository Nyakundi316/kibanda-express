import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import Icon from "@/components/Icon";
import AccountActions from "@/components/AccountActions";
import { profile } from "@/lib/data";

type Row = { icon: string; label: string; hint?: string; danger?: boolean; href?: string };

const accountRows: Row[] = [
  { icon: "receipt_long", label: "My orders", hint: "Track and reorder meals", href: "/orders" },
  { icon: "person", label: "Personal information", hint: "Name, phone, email" },
  { icon: "location_on", label: "Saved addresses", hint: "2 places" },
  { icon: "account_balance_wallet", label: "Payment methods", hint: "M-Pesa" },
];

const moreRows: Row[] = [
  { icon: "notifications", label: "Notifications" },
  { icon: "local_offer", label: "Promo codes & vouchers", hint: "1 active" },
  { icon: "help", label: "Help & support" },
];

function MenuGroup({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="px-margin-mobile mt-lg">
      <h2 className="font-label-sm text-tertiary uppercase tracking-wider mb-sm">
        {title}
      </h2>
      <div className="bg-surface rounded-3xl smooth-shadow divide-y divide-outline-variant/40 overflow-hidden">
        {rows.map((row) => {
          const inner = (
            <>
              <span
                className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  row.danger
                    ? "bg-error-container text-on-error-container"
                    : "bg-primary-fixed text-on-primary-fixed"
                }`}
              >
                <Icon name={row.icon} className="text-xl" />
              </span>
              <span className="flex-grow min-w-0">
                <span
                  className={`font-label-md block ${
                    row.danger ? "text-error" : "text-on-surface"
                  }`}
                >
                  {row.label}
                </span>
                {row.hint ? (
                  <span className="font-label-sm text-tertiary">{row.hint}</span>
                ) : null}
              </span>
              {!row.danger ? (
                <Icon name="chevron_right" className="text-tertiary text-xl" />
              ) : null}
            </>
          );
          const rowClass =
            "w-full flex items-center gap-sm px-sm py-3.5 text-left active:bg-surface-container-low transition-colors";
          return row.href ? (
            <Link key={row.label} href={row.href} className={rowClass}>
              {inner}
            </Link>
          ) : (
            <button key={row.label} type="button" className={rowClass}>
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const { stats } = profile;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Profile"
        action={{ icon: "settings", label: "Settings", href: "/settings" }}
      />
      <main className="pb-32">
        <section className="px-margin-mobile pt-md">
          <div className="flex items-center gap-md">
            <div
              className="w-20 h-20 rounded-full bg-cover bg-center ring-4 ring-primary-fixed flex-shrink-0"
              style={{ backgroundImage: `url('${profile.avatar}')` }}
            />
            <div className="min-w-0">
              <h2 className="font-headline-md text-on-surface text-[22px] truncate">
                {profile.name}
              </h2>
              <p className="font-label-md text-tertiary">{profile.phone}</p>
              <span className="inline-flex items-center gap-1 mt-1 text-secondary font-label-sm">
                <Icon name="verified" className="text-base" fill />
                {profile.joined}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-sm mt-md">
            <div className="bg-surface-container-low rounded-2xl py-sm text-center">
              <p className="font-headline-md text-on-surface text-[20px] tabular-nums">
                {stats.orders}
              </p>
              <p className="font-label-sm text-tertiary">Orders</p>
            </div>
            <div className="bg-surface-container-low rounded-2xl py-sm text-center">
              <p className="font-headline-md text-on-surface text-[20px] tabular-nums">
                {stats.saved}
              </p>
              <p className="font-label-sm text-tertiary">Saved</p>
            </div>
            <div className="bg-primary rounded-2xl py-sm text-center text-on-primary">
              <p className="font-headline-md text-[20px] tabular-nums">
                {stats.points.toLocaleString("en-KE")}
              </p>
              <p className="font-label-sm text-on-primary/80">Points</p>
            </div>
          </div>
        </section>

        <section className="px-margin-mobile mt-md">
          <div className="bg-secondary-container/60 rounded-3xl p-md flex items-center gap-sm">
            <Icon name="redeem" className="text-secondary text-3xl" />
            <div className="flex-grow">
              <p className="font-label-md text-on-secondary-container">
                220 points to your next free delivery
              </p>
              <div className="h-2 bg-surface/70 rounded-full mt-2 overflow-hidden">
                <div className="h-full w-3/4 bg-secondary rounded-full" />
              </div>
            </div>
          </div>
        </section>

        <AccountActions />

        <MenuGroup title="Account" rows={accountRows} />
        <MenuGroup title="More" rows={moreRows} />

        <p className="text-center text-tertiary font-label-sm mt-lg">
          Kibanda Express · v0.1.0
        </p>
      </main>
      <BottomNav />
    </div>
  );
}
