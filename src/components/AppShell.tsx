import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Archive,
  Command,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Plus,
  Search,
  TerminalSquare,
  LogOut,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { StatusDot, StatusPill } from "./StatusPill";
import { useAuth } from "@/lib/auth";
import type { JobStatus } from "@/lib/api";

type NavRoute = "/" | "/search" | "/projects" | "/logs" | "/archived" | "/maintenance" | "/duna";

const NAV_ITEMS: {
  to: NavRoute;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  { to: "/", label: "Overview", mobileLabel: "FEED", icon: LayoutDashboard, exact: true },
  { to: "/search", label: "Search", mobileLabel: "SRCH", icon: Search },
  { to: "/archived", label: "Archived threads", mobileLabel: "ARCH", icon: Archive },
  { to: "/projects", label: "Projects", mobileLabel: "PROJ", icon: FolderKanban },
  { to: "/logs", label: "Agent logs", mobileLabel: "LOGS", icon: TerminalSquare },
  { to: "/duna", label: "Duna", mobileLabel: "DUNA", icon: Waves },
  { to: "/maintenance", label: "Storage", mobileLabel: "STORAGE", icon: HardDrive },
];

function isNavItemActive(pathname: string, item: (typeof NAV_ITEMS)[number]) {
  return item.exact ? pathname === item.to : pathname.startsWith(item.to);
}

export function AppShell({
  children,
  headerRight,
  title = "Command_Center",
  bottomBar,
  status,
}: {
  children: ReactNode;
  headerRight?: ReactNode;
  title?: string;
  bottomBar?: ReactNode | false;
  status?: JobStatus;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { logout } = useAuth();

  return (
    <div className="min-h-screen w-full bg-void text-foreground">
      <DesktopSidebar pathname={pathname} />

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-edge bg-void/85 backdrop-blur-xl">
          <div className="flex h-[68px] min-w-0 items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:px-8">
            <Link to="/" className="flex min-w-0 items-center gap-2 lg:hidden">
              <span className="size-2 shrink-0 rounded-full bg-glow shadow-[var(--shadow-glow)]" />
              <span className="truncate text-xs font-mono tracking-widest uppercase text-muted">
                {title}
              </span>
            </Link>

            <div className="hidden min-w-0 lg:flex lg:flex-1 lg:items-center lg:gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-muted">
                  Remote engineering
                </div>
                <h1 className="mt-1 truncate text-sm font-medium">{title}</h1>
              </div>
              {status && (
                <div
                  className="flex shrink-0 items-center gap-2 rounded-md border border-edge bg-surface/60 px-3 py-1.5"
                  role="status"
                  aria-live="polite"
                  aria-label={`Thread status: ${status}`}
                >
                  <StatusDot status={status} />
                  <StatusPill status={status} />
                </div>
              )}
            </div>

            {status && (
              <div
                className="flex shrink-0 items-center gap-2 rounded-md border border-edge bg-surface/60 px-2.5 py-1 lg:hidden"
                role="status"
                aria-live="polite"
                aria-label={`Thread status: ${status}`}
              >
                <StatusDot status={status} />
                <StatusPill status={status} />
              </div>
            )}

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

        <main className={`min-w-0 ${bottomBar === false ? "pb-0" : "pb-28 lg:pb-24"}`}>
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-64 min-h-0 flex-col overflow-hidden border-r border-edge bg-surface/45 lg:flex">
      <Link to="/" className="flex h-[68px] shrink-0 items-center gap-3 border-b border-edge px-6">
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5">
        <div className="mb-3 px-3 text-[9px] font-mono uppercase tracking-[0.22em] text-muted">
          Workspace
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.filter((item) => item.to !== "/duna").map((item) => {
            const Icon = item.icon;
            return (
              <DesktopNavItem
                key={item.to}
                to={item.to}
                label={item.label}
                icon={<Icon className="size-4" />}
                active={isNavItemActive(pathname, item)}
              />
            );
          })}
        </nav>

        <Link
          to="/compose"
          className="mt-6 flex h-11 items-center justify-center gap-2 rounded-lg bg-glow text-xs font-bold uppercase tracking-widest text-void shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="size-4" />
          New instruction
        </Link>
      </div>

      <div className="shrink-0 border-t border-edge p-4">
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
  to: NavRoute;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/90 px-4 py-3 backdrop-blur-md lg:hidden">
      <Link
        to="/compose"
        aria-label="Instruct agent"
        title="Instruct agent"
        className="absolute -top-14 right-4 flex size-12 items-center justify-center rounded-full bg-glow text-void shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
      >
        <Plus className="size-5" />
      </Link>

      <nav className="grid grid-cols-7">
        {NAV_ITEMS.map((item) => (
          <MobileNavItem
            key={item.to}
            to={item.to}
            label={item.mobileLabel}
            accessibleLabel={item.label}
            active={isNavItemActive(pathname, item)}
          />
        ))}
      </nav>
    </div>
  );
}

function MobileNavItem({
  to,
  label,
  accessibleLabel,
  active,
}: {
  to: NavRoute;
  label: string;
  accessibleLabel: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-label={accessibleLabel}
      aria-current={active ? "page" : undefined}
      className="flex min-w-0 flex-col items-center gap-1"
    >
      <span
        className={`mb-1 size-1 rounded-full ${active ? "bg-glow shadow-[var(--shadow-glow-soft)]" : "bg-transparent"}`}
      />
      <span className={`text-[10px] font-mono ${active ? "text-foreground" : "text-muted"}`}>
        {label}
      </span>
    </Link>
  );
}
