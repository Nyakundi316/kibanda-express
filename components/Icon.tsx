import type { CSSProperties } from "react";

type IconProps = {
  name: string;
  className?: string;
  /** Renders the filled variant of the icon */
  fill?: boolean;
  style?: CSSProperties;
};

export default function Icon({
  name,
  className = "",
  fill = false,
  style,
}: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={
        fill ? { fontVariationSettings: "'FILL' 1", ...style } : style
      }
    >
      {name}
    </span>
  );
}
