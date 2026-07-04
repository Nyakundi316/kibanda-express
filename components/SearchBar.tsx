import Link from "next/link";
import Icon from "./Icon";

// The home search is an entry point — real filtering lives on /market, so this
// hands you off there instead of pretending to search in place.
export default function SearchBar() {
  return (
    <section className="px-margin-mobile pt-sm">
      <Link
        href="/market"
        aria-label="Search meals or kibandas"
        className="flex items-center gap-sm bg-surface-container-low rounded-2xl pl-4 pr-2 py-2.5 active:scale-[0.99] transition-transform"
      >
        <Icon name="search" className="text-tertiary" />
        <span className="flex-grow text-body-md text-tertiary">
          Search meals or kibandas
        </span>
        <span className="p-2 bg-primary rounded-xl text-on-primary flex items-center justify-center">
          <Icon name="tune" className="text-xl" />
        </span>
      </Link>
    </section>
  );
}
