"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Read persisted preference on mount
    const saved = localStorage.getItem("skillforge-theme") as "dark" | "light" | null;
    const initial = saved ?? "dark";
    setTheme(initial);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("skillforge-theme", next);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg backdrop-blur-sm transition-all hover:bg-white/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 light:border-black/10 light:bg-black/5 light:hover:bg-black/10"
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
