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
  Menu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { StatusDot, StatusPill } from "./StatusPill";
import { useAuth } from "@/lib/auth";
import type { JobStatus } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

type NavRoute = "/" | "/search" | "/projects" | "/logs" | "/archived" | "/maintenance";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-void text-foreground">
      <DesktopSidebar pathname={pathname} />

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-edge bg-void/85 backdrop-blur-xl">
          <div className="flex h-[68px] min-w-0 items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:px-8">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    aria-label="Open menu"
                    className="flex size-9 items-center justify-center rounded-md border border-edge text-muted hover:text-foreground"
                  >
                    <Menu className="size-5" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-64 bg-surface/95 backdrop-blur-xl border-edge p-0"
                >
                  <MobileMenuContent
                    pathname={pathname}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                </SheetContent>
              </Sheet>

              <Link to="/" className="flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full bg-glow shadow-[var(--shadow-glow)]" />
                <span className="truncate text-xs font-mono tracking-widest uppercase text-muted">
                  {title}
                </span>
              </Link>
            </div>

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
              <div className="hidden lg:flex lg:items-center lg:gap-2">
                <NotificationBell />
                <ThemeToggle />
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
                className="hidden lg:flex size-9 items-center justify-center rounded-md border border-edge text-muted hover:text-danger"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className={`min-w-0 ${bottomBar === false ? "pb-0" : "pb-24"}`}>{children}</main>

        {bottomBar === false ? null : bottomBar ? (
          <div className="fixed inset-x-0 bottom-0 z-40 lg:left-64">{bottomBar}</div>
        ) : (
          <MobileFloatingButton />
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
          {NAV_ITEMS.map((item) => {
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

function MobileFloatingButton() {
  return (
    <Link
      to="/compose"
      aria-label="Instruct agent"
      title="Instruct agent"
      className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-glow text-void shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void lg:hidden"
    >
      <Plus className="size-6" />
    </Link>
  );
}

function MobileMenuContent({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-edge p-6 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg border border-glow/30 bg-glow-soft text-glow">
            <Command className="size-4" />
          </span>
          <SheetTitle className="text-left">
            <span className="block text-sm font-semibold tracking-wide">Command Center</span>
            <span className="mt-0.5 block text-[9px] font-mono uppercase tracking-[0.2em] text-muted">
              Remote workspace
            </span>
          </SheetTitle>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto overscroll-contain p-3">
        <div className="mb-3 px-3 text-[9px] font-mono uppercase tracking-[0.22em] text-muted">
          Workspace
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-xs transition-colors ${
                  active
                    ? "border border-glow/25 bg-glow-soft text-foreground"
                    : "border border-transparent text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <span className={active ? "text-glow" : "text-muted"}>
                  <Icon className="size-4" />
                </span>
                <span>{item.label}</span>
                {active && <span className="ml-auto size-1 rounded-full bg-glow" />}
              </Link>
            );
          })}
        </nav>

        <Link
          to="/compose"
          onClick={onNavigate}
          className="mt-6 flex h-11 items-center justify-center gap-2 rounded-lg bg-glow text-xs font-bold uppercase tracking-widest text-void shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5"
        >
          <Plus className="size-4" />
          New instruction
        </Link>
      </div>

      <div className="shrink-0 border-t border-edge p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
          <button
            onClick={() => {
              logout();
              onNavigate();
            }}
            className="flex items-center gap-2 rounded-md border border-edge px-3 py-2 text-xs text-muted hover:text-danger hover:border-danger/50 transition-colors"
          >
            <LogOut className="size-4" />
            <span>Sign out</span>
          </button>
        </div>

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
    </div>
  );
}
