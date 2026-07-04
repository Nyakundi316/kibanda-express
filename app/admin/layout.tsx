import Link from "next/link";
import RequireRole from "@/components/RequireRole";
import Icon from "@/components/Icon";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole roles={["admin"]}>
      <div className="pb-12">
        <header className="sticky top-0 z-40 bg-on-surface text-surface px-margin-mobile py-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="admin_panel_settings" className="text-2xl text-secondary" />
            <span className="font-headline-md text-[18px]">Admin Console</span>
          </div>
          <Link href="/" className="text-surface/70 font-label-sm flex items-center gap-1">
            <Icon name="exit_to_app" className="text-lg" /> App
          </Link>
        </header>
        {children}
      </div>
    </RequireRole>
  );
}
