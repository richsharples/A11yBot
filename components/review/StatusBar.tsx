"use client";

import React, { useState, useEffect, useRef } from "react";
import type { StatusLevel, StatusEntry } from "./types";
import { Tooltip } from "./Tooltip";

export function StatusBar({ entries, onClear }: { entries: StatusEntry[]; onClear: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, collapsed]);

  const latest = entries[entries.length - 1];

  const levelStyle: Record<StatusLevel, string> = {
    info:    "text-slate-300",
    warn:    "text-yellow-400",
    error:   "text-red-400",
    running: "text-blue-400",
  };
  const badgeStyle: Record<StatusLevel, string> = {
    info:    "bg-green-900 text-green-300",
    warn:    "bg-yellow-900 text-yellow-300",
    error:   "bg-red-900 text-red-300",
    running: "bg-blue-900 text-blue-300",
  };
  const badgeIcon: Record<StatusLevel, React.ReactNode> = {
    info:    "✓",
    warn:    "⚠",
    error:   "✕",
    running: <span className="inline-flex items-center gap-1"><span className="animate-spin inline-block">↻</span> running</span>,
  };

  return (
    <div className="sticky bottom-0 z-20 border-t border-slate-700 bg-slate-900 text-xs font-mono select-text">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-700">
        <Tooltip text={collapsed ? "Expand status panel" : "Collapse status panel"}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={collapsed ? "Expand status" : "Collapse status"}
          >
            <span className="text-slate-500">{collapsed ? "▲" : "▼"}</span>
            <span className="font-semibold tracking-wide uppercase text-slate-400">Status</span>
          </button>
        </Tooltip>
        {collapsed && latest && (
          <span className={`truncate max-w-xl ${levelStyle[latest.level]}`}>
            <span className="text-slate-500 mr-1">{latest.ts}</span>
            {latest.message}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {entries.length > 0 && (
            <span className="text-slate-500">{entries.length} entr{entries.length === 1 ? "y" : "ies"}</span>
          )}
          <Tooltip text="Clear all status messages">
            <button
              onClick={onClear}
              className="text-slate-500 hover:text-slate-300 transition-colors px-1"
            >
              Clear
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Log entries */}
      {!collapsed && (
        <div ref={scrollRef} className="h-32 overflow-y-auto px-3 py-1.5 space-y-0.5">
          {entries.length === 0 ? (
            <div className="text-slate-600 italic py-1">No activity yet.</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className={`flex gap-2 items-start leading-5 ${levelStyle[e.level]}`}>
                <span className="text-slate-600 shrink-0">{e.ts}</span>
                <span className={`shrink-0 px-1 rounded text-[10px] font-semibold ${badgeStyle[e.level]}`}>
                  {badgeIcon[e.level]}
                </span>
                <span className="break-all">{e.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
