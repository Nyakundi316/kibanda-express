import Icon from "./Icon";
import NotificationBell from "./NotificationBell";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-surface shadow-sm">
      <div className="flex items-center gap-sm px-margin-mobile py-base">
        <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0">
          <Icon name="location_on" fill className="text-xl" />
        </div>
        <div className="min-w-0 flex-grow leading-tight">
          <span className="block font-label-sm text-[10px] text-tertiary uppercase tracking-wider">
            Kibanda Express · Deliver to
          </span>
          <span className="flex items-center font-label-md text-on-surface text-[15px]">
            <span className="truncate">Westlands, Nairobi</span>
            <Icon name="expand_more" className="text-lg text-tertiary flex-shrink-0" />
          </span>
        </div>
        <NotificationBell />
      </div>
    </header>
  );
}
