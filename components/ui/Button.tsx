"use client";
import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size    = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center gap-1.5 font-medium leading-none rounded disabled:opacity-50 transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const variants: Record<Variant, string> = {
  primary:   "bg-accent text-white hover:bg-accent-hover border border-accent px-4 py-2.5 text-[13.5px]",
  secondary: "bg-surface text-ink-1 border border-rule hover:bg-surface-2 px-4 py-2.5 text-[13.5px]",
  ghost:     "text-ink-2 hover:bg-surface-2 px-2 py-1.5 text-[13.5px]",
  danger:    "text-issue hover:bg-issue-bg px-2 py-1.5 text-[13.5px]",
};

const sizes: Record<Size, string> = {
  sm: "text-[12px] px-3 py-1.5",
  md: "",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size, className = "", children, ...props }, ref) => {
    const sizeClass = size ? sizes[size] : "";
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizeClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
