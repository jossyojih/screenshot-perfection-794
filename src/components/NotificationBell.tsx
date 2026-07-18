import { Link } from "@tanstack/react-router";
import { threads } from "@/lib/mock-data";

export function NotificationBell() {
  const needsInput = threads.filter((t) => t.status === "needs_input").length;
  const failed = threads.filter((t) => t.status === "failed").length;
  const done = threads.filter((t) => t.status === "done").length;
  const total = needsInput + failed + done;

  const tone =
    failed > 0 ? "border-danger/50 bg-danger-soft text-danger"
    : needsInput > 0 ? "border-alert/50 bg-alert-soft text-alert"
    : done > 0 ? "border-glow/40 bg-glow-soft text-glow"
    : "border-edge bg-surface text-muted";

  return (
    <Link
      to="/"
      aria-label={`${total} notifications`}
      className={`relative px-2 py-0.5 rounded border flex items-center gap-1.5 transition-colors ${tone}`}
    >
      <BellIcon />
      <span className="text-[10px] font-mono uppercase tracking-widest">{total}</span>
      {failed > 0 && (
        <span className="absolute -top-1 -right-1 size-2 rotate-45 bg-danger shadow-[var(--shadow-danger)]" />
      )}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
