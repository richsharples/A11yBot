// components/Logo.tsx
//
// A11yBot mark — geometric robot head, replaces the bitmap logo at
// public/a11ybot-logo.png. Vector source means it renders cleanly at any
// scale (16px favicon through 320px setup hero).
//
// Three variants:
//   <Logo />         — canonical mark. Token-driven: body = --brand,
//                      eyes = --accent, smile = --surface. Automatically
//                      flips correctly in dark mode (since --brand
//                      becomes light and --surface becomes dark).
//                      Use this 90% of the time.
//   <LogoReversed /> — explicit white-on-dark. Use only when you need
//                      to force the dark-bg variant regardless of theme
//                      (e.g. printing on a hero-image dark background
//                      in light mode, README hero in a Markdown file).
//   <LogoLine />     — outline only. Lightweight option for very small
//                      sizes or printed contexts.
//
// `size` defaults to 32 (a comfortable in-app header size). Pass any
// integer in CSS px. The component sets `aria-hidden` since the wordmark
// next to it is what screen readers should read.

import * as React from "react";

type LogoProps = {
  size?: number;
  className?: string;
  title?: string;
};

function Frame({
  size,
  className,
  title,
  children,
}: LogoProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size ?? 32}
      height={size ?? 32}
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/**
 * Canonical mark. Token-driven so it flips correctly with dark mode.
 *  body  = var(--brand)    — navy in light, near-white in dark
 *  eyes  = var(--accent)   — accent blue (lifted in dark)
 *  smile = var(--surface)  — cuts out cleanly against the body
 */
export function Logo(props: LogoProps) {
  return (
    <Frame {...props}>
      <g fill="var(--brand, #0B1B33)">
        <rect x="8" y="10" width="32" height="26" rx="4" />
        <rect x="5" y="18" width="3" height="8" rx="1" />
        <rect x="40" y="18" width="3" height="8" rx="1" />
        <rect x="22.5" y="2" width="3" height="9" rx="1.5" />
        <circle cx="24" cy="2.5" r="2" />
        <rect x="20" y="36" width="3" height="5" rx="1" />
        <rect x="25" y="36" width="3" height="5" rx="1" />
      </g>
      <g fill="var(--accent, #1F6FEB)">
        <rect x="15" y="18" width="6" height="6" rx="1" />
        <rect x="27" y="18" width="6" height="6" rx="1" />
      </g>
      {/* smile cuts out of the body color */}
      <path d="M18 28h12v2H18z" fill="var(--surface, #FBFCFD)" />
    </Frame>
  );
}

/** White-on-dark variant. Use on the brand navy or any dark surface. */
export function LogoReversed(props: LogoProps) {
  return (
    <Frame {...props}>
      <g fill="#FFFFFF">
        <rect x="8" y="10" width="32" height="26" rx="4" />
        <rect x="5" y="18" width="3" height="8" rx="1" />
        <rect x="40" y="18" width="3" height="8" rx="1" />
        <rect x="22.5" y="2" width="3" height="9" rx="1.5" />
        <circle cx="24" cy="2.5" r="2" />
        <rect x="20" y="36" width="3" height="5" rx="1" />
        <rect x="25" y="36" width="3" height="5" rx="1" />
      </g>
      <g fill="var(--brand, #0B1B33)">
        <rect x="15" y="18" width="6" height="6" rx="1" />
        <rect x="27" y="18" width="6" height="6" rx="1" />
        <path d="M18 28h12v2H18z" />
      </g>
    </Frame>
  );
}

/** Outline-only variant. Use for very small sizes or print. */
export function LogoLine(props: LogoProps) {
  return (
    <Frame {...props}>
      <g
        fill="none"
        stroke="var(--brand, #0B1B33)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M24 4v6" />
        <circle cx="24" cy="3" r="1.5" fill="currentColor" />
        <rect x="8" y="10" width="32" height="26" rx="4" />
        <path d="M8 18h-3v8h3" />
        <path d="M40 18h3v8h-3" />
        <path d="M18 29h12" />
        <path d="M20 36v4M28 36v4" />
        <rect
          x="15"
          y="18"
          width="6"
          height="6"
          rx="1"
          fill="var(--brand, #0B1B33)"
          stroke="none"
        />
        <rect
          x="27"
          y="18"
          width="6"
          height="6"
          rx="1"
          fill="var(--brand, #0B1B33)"
          stroke="none"
        />
      </g>
    </Frame>
  );
}

/** Full lockup — mark + wordmark. */
export function LogoLockup({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontWeight: 700,
        color: "var(--ink-1, #0B1B33)",
        fontSize: Math.round(size * 0.85),
        letterSpacing: "-0.012em",
        lineHeight: 1,
      }}
    >
      <Logo size={size} title="A11yBot" />
      <span>A11yBot</span>
    </div>
  );
}

export default Logo;
