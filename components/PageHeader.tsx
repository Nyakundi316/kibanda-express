import Link from "next/link";
import Icon from "./Icon";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  action?: { icon: string; label: string; href?: string };
  right?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, action, right }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex items-center gap-sm px-margin-mobile py-base w-full bg-surface shadow-sm">
      <Link
        href="/"
        aria-label="Back to home"
        className="p-xs -ml-1 rounded-full hover:bg-surface-variant transition-colors"
      >
        <Icon name="arrow_back_ios_new" className="text-on-surface text-xl" />
      </Link>
      <div className="flex flex-col leading-tight">
        <h1 className="font-headline-md text-on-surface">{title}</h1>
        {subtitle ? (
          <span className="font-label-sm text-tertiary">{subtitle}</span>
        ) : null}
      </div>
      {right ? <div className="ml-auto">{right}</div> : null}
      {action ? (
        action.href ? (
          <Link
            href={action.href}
            aria-label={action.label}
            className="ml-auto flex items-center gap-1 text-primary font-label-md px-xs py-1 rounded-full hover:bg-surface-variant active:scale-95 transition-transform"
          >
            <Icon name={action.icon} className="text-xl" />
          </Link>
        ) : (
          <button
            type="button"
            aria-label={action.label}
            className="ml-auto flex items-center gap-1 text-primary font-label-md px-xs py-1 rounded-full active:scale-95 transition-transform"
          >
            <Icon name={action.icon} className="text-xl" />
          </button>
        )
      ) : null}
    </header>
  );
}
