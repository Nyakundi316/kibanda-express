import SellerNav from "@/components/SellerNav";
import RequireRole from "@/components/RequireRole";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole roles={["seller", "admin"]}>
      <div className="pb-24">{children}</div>
      <SellerNav />
    </RequireRole>
  );
}
