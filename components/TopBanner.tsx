"use client";

import { LogoLockup } from "@/components/Logo";
import pkg from "../package.json";

interface Props {
  /** Opens the global settings overlay. */
  onOpenSettings?: () => void;
  /** Optional click on the logo (e.g. back to home). */
  onLogoClick?: () => void;
  /** Opens the navigation drawer. Shows a hamburger to the left of the logo when provided. */
  onOpenMenu?: () => void;
}

/**
 * Global top banner — consistent across every screen (hub, wizard, project).
 * Holds app identity (logo + wordmark + version) and global actions (settings).
 * Project-specific context belongs in a separate secondary banner below this.
 */
export function TopBanner({ onOpenSettings, onLogoClick, onOpenMenu }: Props) {
  return (
    <header className="bg-surface border-b border-rule px-8 py-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="-ml-1 p-1.5 rounded-md text-ink-2 hover:text-ink-1 hover:bg-surface-2 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {onLogoClick ? (
          <button type="button" onClick={onLogoClick} aria-label="Back to home" className="hover:opacity-80 transition-opacity">
            <LogoLockup size={32} />
          </button>
        ) : (
          <LogoLockup size={32} />
        )}
        <span className="px-1.5 py-0.5 rounded-sm bg-surface-3 text-ink-3 font-mono text-caption">
          v{pkg.version}
        </span>
      </div>

      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="-mr-1 p-1.5 rounded-md text-ink-2 hover:text-ink-1 hover:bg-surface-2 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </header>
  );
}
