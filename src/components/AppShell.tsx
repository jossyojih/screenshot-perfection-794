import { Link, useRouterState } from "@tanstack/react-router";
import {
  Archive,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Plus,
  TerminalSquare,
  LogOut,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/lib/auth";

type NavRoute = "/" | "/projects" | "/logs" | "/archived" | "/maintenance" | "/duna";

const NAV_ITEMS: {
  to: NavRoute;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  { to: "/", label: "Overview", mobileLabel: "FEED", icon: LayoutDashboard, exact: true },
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
      <div className="min-h-screen">
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

        <main className={`min-w-0 ${bottomBar === false ? "pb-0" : "pb-28 lg:pb-24"}`}>
          {children}
        </main>

        {bottomBar === false ? null : bottomBar ? (
          <div className="fixed inset-x-0 bottom-0 z-40">{bottomBar}</div>
        ) : (
          <MobileBottomBar pathname={pathname} />
        )}
      </div>
    </div>
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

      <nav className="grid grid-cols-6">
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
