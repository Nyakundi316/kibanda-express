import CartHeader from "@/components/CartHeader";
import CartList from "@/components/CartList";
import BottomNav from "@/components/BottomNav";

export default function CartPage() {
  return (
    <div className="min-h-screen">
      <CartHeader />
      <main className="pb-32">
        <CartList />
      </main>
      <BottomNav />
    </div>
  );
}
