import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({
  children,
  headerRight,
  title = "Command_Center",
  bottomBar,
}: {
  children: ReactNode;
  headerRight?: ReactNode;
  title?: string;
  bottomBar?: ReactNode | false;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen w-full bg-void text-foreground flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col border-x border-edge">
        <header className="px-4 pt-6 pb-4 border-b border-edge flex items-center justify-between shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-glow shadow-[var(--shadow-glow)]" />
            <h1 className="text-xs font-mono tracking-widest uppercase text-muted">{title}</h1>
          </Link>
          {headerRight ?? (
            <div className="px-2 py-0.5 rounded border border-glow/30 bg-glow-soft">
              <span className="text-[10px] font-mono text-glow uppercase">2 Agents Live</span>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto pb-44">{children}</div>

        {bottomBar === false ? null : bottomBar ? (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px]">
            {bottomBar}
          </div>
        ) : (
          <BottomBar pathname={pathname} />
        )}
      </div>
    </div>
  );
}

function BottomBar({ pathname }: { pathname: string }) {
  const isFeed = pathname === "/";
  const isProj = pathname.startsWith("/projects");
  const isLogs = pathname.startsWith("/logs");

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] p-4 border-t border-edge bg-surface/80 backdrop-blur-md">
      <Link
        to="/compose"
        className="flex items-center gap-3 group"
        aria-label="Instruct agent"
      >
        <div className="flex-1 bg-void border border-edge rounded-full px-4 h-11 flex items-center text-muted group-hover:border-glow/40 transition-colors">
          <span className="text-xs">Instruct agent...</span>
        </div>
        <span className="size-11 bg-foreground text-void rounded-full flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="size-4"
          >
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>

      <nav className="flex justify-around mt-4 pt-2">
        <NavItem to="/" label="FEED" active={isFeed} />
        <NavItem to="/projects" label="PROJ" active={isProj} />
        <NavItem to="/logs" label="LOGS" active={isLogs} />
      </nav>
    </div>
  );
}

function NavItem({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1">
      <span
        className={`size-1 mb-1 rounded-full ${
          active ? "bg-glow shadow-[var(--shadow-glow-soft)]" : "bg-transparent"
        }`}
      />
      <span className={`text-[10px] font-mono ${active ? "text-foreground" : "text-muted"}`}>
        {label}
      </span>
    </Link>
  );
}
