import Link from "next/link";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import Categories from "@/components/Categories";
import NearbyVendors from "@/components/NearbyVendors";
import PopularMeals from "@/components/PopularMeals";
import MarketShelf from "@/components/MarketShelf";
import OrderAgain from "@/components/OrderAgain";
import BottomNav from "@/components/BottomNav";
import Icon from "@/components/Icon";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pb-32">
        <SearchBar />

        <OrderAgain />

        {/* Marketplace promo banner */}
        <Link
          href="/market"
          className="mx-margin-mobile mt-md block relative overflow-hidden rounded-3xl bg-primary text-on-primary p-md active:scale-[0.99] transition-transform"
        >
          <div className="relative z-10 pr-14">
            <p className="font-headline-md text-[18px] leading-snug">
              Karibu! The market is open
            </p>
            <p className="font-label-sm text-on-primary/85 mt-1">
              Real kibandas near you — order & pay with M-Pesa
            </p>
            <span className="inline-flex items-center gap-1 bg-on-primary text-primary font-label-sm px-3 py-1.5 rounded-full mt-sm">
              Order now <Icon name="arrow_forward" className="text-base" />
            </span>
          </div>
          <Icon
            name="skillet"
            className="absolute -right-2 -bottom-5 text-[100px] text-on-primary/15 -rotate-12"
          />
        </Link>

        <Categories />
        <MarketShelf />
        <NearbyVendors />
        <PopularMeals />
      </main>
      <BottomNav />
    </div>
  );
}
