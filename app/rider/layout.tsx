import RequireRole from "@/components/RequireRole";
import RiderNav from "@/components/RiderNav";

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["rider", "admin"]}>
      <div className="pb-24">{children}</div>
      <RiderNav />
    </RequireRole>
  );
}
