import * as React from "react";

type Variant = "issue" | "warn" | "ok" | "accent";

const styles: Record<Variant, { wrap: string; icon: string; dot: string }> = {
  issue:  { wrap: "bg-issue-bg border-issue-rule text-issue",  icon: "bg-issue",  dot: "bg-issue"  },
  warn:   { wrap: "bg-warn-bg border-warn-rule text-warn",     icon: "bg-warn",   dot: "bg-warn"   },
  ok:     { wrap: "bg-ok-bg border-ok-rule text-ok",           icon: "bg-ok",     dot: "bg-ok"     },
  accent: { wrap: "bg-accent-soft border-accent-rule text-accent", icon: "bg-accent", dot: "bg-accent" },
};

const icons: Record<Variant, string> = {
  issue: "!",
  warn:  "~",
  ok:    "✓",
  accent: "i",
};

interface BannerProps {
  variant: Variant;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Banner({ variant, action, children, className = "" }: BannerProps) {
  const s = styles[variant];
  return (
    <div className={`flex items-start gap-3 p-4 rounded-md border ${s.wrap} ${className}`}>
      <span className={`shrink-0 w-5 h-5 rounded-full ${s.icon} text-white flex items-center justify-center font-bold text-[11px] mt-px`} aria-hidden="true">
        {icons[variant]}
      </span>
      <div className="flex-1 text-small leading-relaxed">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default Banner;
