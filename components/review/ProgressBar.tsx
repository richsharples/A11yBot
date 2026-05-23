"use client";

import React from "react";

export function ProgressBar({ evaluated, total, confirmed }: { evaluated: number; total: number; confirmed: number }) {
  const pct = total ? Math.round((evaluated / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm text-[#39FF14]/50 font-mono">
      <div className="w-32 h-1.5 bg-[#39FF14]/10 rounded-full overflow-hidden border border-[#39FF14]/20">
        <div className="h-full bg-[#39FF14] rounded-full transition-all" style={{ width: `${pct}%`, boxShadow: "0 0 6px #39FF14aa" }} />
      </div>
      <span>{evaluated}/{total} evaluated</span>
      {confirmed > 0 && <span className="text-[#39FF14]/70">({confirmed} confirmed)</span>}
    </div>
  );
}
