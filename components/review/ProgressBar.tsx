"use client";

import React from "react";

export function ProgressBar({ evaluated, total, confirmed }: { evaluated: number; total: number; confirmed: number }) {
  const pct = total ? Math.round((evaluated / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span>{evaluated}/{total} evaluated</span>
      {confirmed > 0 && <span className="text-green-600">({confirmed} confirmed)</span>}
    </div>
  );
}
