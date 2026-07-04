"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");

  useEffect(() => {
    const fade = setTimeout(() => setPhase("leaving"), 1600);
    const drop = setTimeout(() => setPhase("gone"), 2200);
    return () => {
      clearTimeout(fade);
      clearTimeout(drop);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-primary transition-opacity duration-500 ${
        phase === "leaving" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center splash-rise">
        <div className="w-24 h-24 rounded-3xl bg-on-primary flex items-center justify-center shadow-2xl shadow-black/20">
          <span className="font-headline-md text-primary text-[40px] font-extrabold tracking-tight">
            KB
          </span>
        </div>
        <p className="mt-md font-headline-md text-on-primary text-[22px] tracking-wide">
          Kibanda Express
        </p>
        <p className="mt-1 font-label-sm text-on-primary/70">
          Nairobi street food, delivered
        </p>
      </div>

      <div className="absolute bottom-16 flex gap-2">
        <span className="w-2 h-2 rounded-full bg-on-primary/80 splash-dot" />
        <span className="w-2 h-2 rounded-full bg-on-primary/80 splash-dot [animation-delay:160ms]" />
        <span className="w-2 h-2 rounded-full bg-on-primary/80 splash-dot [animation-delay:320ms]" />
      </div>
    </div>
  );
}
