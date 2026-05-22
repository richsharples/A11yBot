"use client";

import React from "react";

export function Tooltip({ text, children, side = "top", className }: {
  text: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span className={`relative group/tip inline-flex${className ? ` ${className}` : ""}`}>
      {children}
      <span className={[
        "absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none",
        "px-2 py-1 rounded bg-gray-900 text-white text-[11px] leading-snug whitespace-nowrap max-w-xs text-center",
        "opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 delay-500",
        side === "top" ? "bottom-full mb-2" : "top-full mt-2",
      ].join(" ")}>
        {text}
        <span className={[
          "absolute left-1/2 -translate-x-1/2 border-4 border-transparent",
          side === "top" ? "top-full border-t-gray-900" : "bottom-full border-b-gray-900",
        ].join(" ")} />
      </span>
    </span>
  );
}
