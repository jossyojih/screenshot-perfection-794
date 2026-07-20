import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Command,
  FolderKanban,
  LayoutDashboard,
  Plus,
  TerminalSquare,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/lib/auth";

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
  const { logout } = useAuth();

  return (
    <div className="min-h-screen w-full bg-void text-foreground">
      <DesktopSidebar pathname={pathname} />

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-edge bg-void/85 backdrop-blur-xl">
          <div className="flex h-[68px] min-w-0 items-center justify-between gap-3 px-4 lg:px-8">
            <Link to="/" className="flex min-w-0 items-center gap-2 lg:hidden">
              <span className="size-2 shrink-0 rounded-full bg-glow shadow-[var(--shadow-glow)]" />
              <span className="truncate text-xs font-mono tracking-widest uppercase text-muted">
                {title}
              </span>
            </Link>

            <div className="hidden min-w-0 lg:block">
              <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-muted">
                Remote engineering
              </div>
              <h1 className="mt-1 truncate text-sm font-medium">{title}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {headerRight}
              <NotificationBell />
              <ThemeToggle />
              <button
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
                className="flex size-9 items-center justify-center rounded-md border border-edge text-muted hover:text-danger"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className={`min-w-0 ${bottomBar === false ? "pb-8" : "pb-44 lg:pb-24"}`}>
          {children}
        </main>

        {bottomBar === false ? null : bottomBar ? (
          <div className="fixed inset-x-0 bottom-0 z-40 lg:left-64">{bottomBar}</div>
        ) : (
          <MobileBottomBar pathname={pathname} />
        )}
      </div>
    </div>
  );
}

function DesktopSidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-edge bg-surface/45 lg:flex">
      <Link to="/" className="flex h-[68px] items-center gap-3 border-b border-edge px-6">
        <span className="flex size-8 items-center justify-center rounded-lg border border-glow/30 bg-glow-soft text-glow">
          <Command className="size-4" />
        </span>
        <span>
          <span className="block text-xs font-semibold tracking-wide">Command Center</span>
          <span className="mt-0.5 block text-[9px] font-mono uppercase tracking-[0.2em] text-muted">
            Remote workspace
          </span>
        </span>
      </Link>

      <div className="flex-1 px-3 py-5">
        <div className="mb-3 px-3 text-[9px] font-mono uppercase tracking-[0.22em] text-muted">
          Workspace
        </div>
        <nav className="space-y-1">
          <DesktopNavItem
            to="/"
            label="Overview"
            icon={<LayoutDashboard className="size-4" />}
            active={pathname === "/"}
          />
          <DesktopNavItem
            to="/projects"
            label="Projects"
            icon={<FolderKanban className="size-4" />}
            active={pathname.startsWith("/projects")}
          />
          <DesktopNavItem
            to="/logs"
            label="Agent logs"
            icon={<TerminalSquare className="size-4" />}
            active={pathname.startsWith("/logs")}
          />
        </nav>

        <Link
          to="/compose"
          className="mt-6 flex h-11 items-center justify-center gap-2 rounded-lg bg-glow text-xs font-bold uppercase tracking-widest text-void shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="size-4" />
          New instruction
        </Link>
      </div>

      <div className="border-t border-edge p-4">
        <div className="rounded-lg border border-edge bg-void/60 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted">
              <Activity className="size-3.5 text-glow" /> System
            </span>
            <span className="size-1.5 rounded-full bg-glow shadow-[var(--shadow-glow-soft)]" />
          </div>
          <div className="mt-2 text-xs font-medium">EC2 runner online</div>
          <div className="mt-1 text-[9px] font-mono text-muted">eu-west-2 · 3 agents ready</div>
        </div>
      </div>
    </aside>
  );
}

function DesktopNavItem({
  to,
  label,
  icon,
  active,
}: {
  to: "/" | "/projects" | "/logs";
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex h-10 items-center gap-3 rounded-lg px-3 text-xs transition-colors ${
        active
          ? "border border-glow/25 bg-glow-soft text-foreground"
          : "border border-transparent text-muted hover:bg-surface hover:text-foreground"
      }`}
    >
      <span className={active ? "text-glow" : "text-muted"}>{icon}</span>
      <span>{label}</span>
      {active && <span className="ml-auto size-1 rounded-full bg-glow" />}
    </Link>
  );
}

function MobileBottomBar({ pathname }: { pathname: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/90 p-4 backdrop-blur-md lg:hidden">
      <Link to="/compose" className="flex items-center gap-3 group" aria-label="Instruct agent">
        <div className="flex h-11 flex-1 items-center rounded-full border border-edge bg-void px-4 text-muted transition-colors group-hover:border-glow/40">
          <span className="text-xs">Instruct agent...</span>
        </div>
        <span className="flex size-11 items-center justify-center rounded-full bg-foreground text-void">
          <Plus className="size-4" />
        </span>
      </Link>

      <nav className="mt-4 flex justify-around pt-2">
        <MobileNavItem to="/" label="FEED" active={pathname === "/"} />
        <MobileNavItem to="/projects" label="PROJ" active={pathname.startsWith("/projects")} />
        <MobileNavItem to="/logs" label="LOGS" active={pathname.startsWith("/logs")} />
      </nav>
    </div>
  );
}

function MobileNavItem({
  to,
  label,
  active,
}: {
  to: "/" | "/projects" | "/logs";
  label: string;
  active: boolean;
}) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1">
      <span
        className={`mb-1 size-1 rounded-full ${active ? "bg-glow shadow-[var(--shadow-glow-soft)]" : "bg-transparent"}`}
      />
      <span className={`text-[10px] font-mono ${active ? "text-foreground" : "text-muted"}`}>
        {label}
      </span>
    </Link>
  );
}
