"use client";
import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("a11ybot-theme") as Theme) ?? "system";
    setThemeState(stored);
  }, []);

  const apply = useCallback((next: Theme) => {
    const root = document.documentElement;
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effective = next === "system" ? (prefers ? "dark" : "light") : next;
    root.classList.toggle("dark", effective === "dark");
    root.dataset.theme = next;
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem("a11ybot-theme", next);
    apply(next);
  }, [apply]);

  // Follow OS changes when in 'system' mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, apply]);

  return { theme, setTheme };
}
