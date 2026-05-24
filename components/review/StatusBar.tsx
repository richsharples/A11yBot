"use client";

import React, { useState, useEffect, useRef } from "react";
import type { StatusLevel, StatusEntry } from "./types";
import { Tooltip } from "./Tooltip";
import { Button } from "@/components/ui/Button";

export function StatusBar({ entries, onClear, forceExpanded }: { entries: StatusEntry[]; onClear: () => void; forceExpanded?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (forceExpanded) setCollapsed(false);
  }, [forceExpanded]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, collapsed]);

  const latest = entries[entries.length - 1];

  const levelText: Record<StatusLevel, string> = {
    info:    "text-ink-2",
    warn:    "text-warn",
    error:   "text-issue",
    running: "text-accent",
  };

  const dot: Record<StatusLevel, string> = {
    info:    "bg-ok",
    warn:    "bg-warn",
    error:   "bg-issue",
    running: "bg-accent animate-pulse",
  };

  return (
    <div className="sticky bottom-0 z-20 border-t border-rule bg-surface-2 select-text">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-rule">
        <Tooltip text={collapsed ? "Expand status panel" : "Collapse status panel"}>
          <Button variant="ghost" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand status" : "Collapse status"}>
            <span className="text-ink-4">{collapsed ? "▲" : "▼"}</span>
            <span className="eyebrow">Status</span>
          </Button>
        </Tooltip>
        {collapsed && latest && (
          <span className={`truncate max-w-xl text-small font-mono ${levelText[latest.level]}`}>
            <span className="text-ink-4 mr-1">{latest.ts}</span>
            {latest.message}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {entries.length > 0 && (
            <span className="text-caption text-ink-4">{entries.length} entr{entries.length === 1 ? "y" : "ies"}</span>
          )}
          <Tooltip text="Clear all status messages">
            <Button variant="ghost" onClick={onClear}>Clear</Button>
          </Tooltip>
        </div>
      </div>

      {/* Log entries */}
      {!collapsed && (
        <div ref={scrollRef} className="h-32 overflow-y-auto px-3 py-1.5 space-y-0.5">
          {entries.length === 0 ? (
            <div className="text-small text-ink-4 italic py-1">No activity yet.</div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className={`flex gap-2 items-start leading-5 ${levelText[e.level]}`}>
                <span className="text-caption font-mono text-ink-4 shrink-0">{e.ts}</span>
                <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${dot[e.level]}`} aria-hidden="true" />
                <span className="text-small font-sans break-all">{e.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
