import { Suspense } from "react";
import PageHeader from "@/components/PageHeader";
import MyOrders from "@/components/MyOrders";
import BottomNav from "@/components/BottomNav";
import NotificationBell from "@/components/NotificationBell";

export default function OrdersPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Orders" subtitle="Track and reorder your meals" right={<NotificationBell />} />
      <main className="pb-32">
        <Suspense fallback={null}>
          <MyOrders />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
