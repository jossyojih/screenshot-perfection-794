import { useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "cc-theme";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", t === "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#FBFBFC" : "#0A0A0B");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "dark";
    setTheme(stored);
    applyTheme(stored);
    setReady(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(KEY, next);
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="px-2 py-0.5 rounded border border-edge bg-surface hover:border-glow/40 transition-colors flex items-center gap-1.5"
    >
      <span className="size-1.5 rounded-full bg-glow shadow-[var(--shadow-glow-soft)]" />
      <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
        {ready ? (theme === "dark" ? "DARK" : "LITE") : "----"}
      </span>
    </button>
  );
}
