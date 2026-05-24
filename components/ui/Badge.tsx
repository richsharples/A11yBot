import * as React from "react";

type Variant = "issue" | "warn" | "ok" | "accent" | "neutral";

const styles: Record<Variant, string> = {
  issue:   "bg-issue-bg text-issue border-issue-rule",
  warn:    "bg-warn-bg text-warn border-warn-rule",
  ok:      "bg-ok-bg text-ok border-ok-rule",
  accent:  "bg-accent-soft text-accent border-accent-rule",
  neutral: "bg-surface-3 text-ink-3 border-rule",
};

interface BadgeProps {
  variant: Variant;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, icon, children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-caption px-1.5 py-0.5 rounded-full border ${styles[variant]} ${className}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

export default Badge;
