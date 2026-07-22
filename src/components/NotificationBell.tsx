import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getJobs } from "@/lib/api";
import { groupJobsByThread } from "@/lib/threads";

export function NotificationBell() {
  const [revalidating, setRevalidating] = useState(false);
  const { data = [], refetch } = useQuery({
    queryKey: ["jobs"],
    queryFn: getJobs,
    refetchInterval: 2000,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
  });
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setRevalidating(true);
      void refetch().finally(() => setRevalidating(false));
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [refetch]);
  const threads = groupJobsByThread(data);
  const needsInput = threads.filter((thread) => thread.latestRun.status === "needs_input").length;
  const failed = threads.filter((thread) => thread.latestRun.status === "failed").length;
  const total = needsInput + failed;

  const tone =
    failed > 0
      ? "border-danger/50 bg-danger-soft text-danger"
      : needsInput > 0
        ? "border-alert/50 bg-alert-soft text-alert"
        : "border-edge bg-surface text-muted";

  return (
    <Link
      to="/"
      aria-label={
        revalidating
          ? "Refreshing threads that need attention."
          : `${total} thread${total === 1 ? "" : "s"} need attention. View overview.`
      }
      className={`relative px-2 py-0.5 rounded border flex items-center gap-1.5 transition-colors ${tone}`}
    >
      <BellIcon />
      <span className="text-[10px] font-mono uppercase tracking-widest">
        {revalidating ? "..." : total}
      </span>
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
