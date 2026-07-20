import type { JobStatus } from "@/lib/api";

export const threadStatusLabel: Record<JobStatus, string> = {
  queued: "QUEUED",
  running: "RUNNING",
  needs_input: "NEEDS INPUT",
  failed: "FAILED",
  cancelled: "CANCELLED",
  done: "DONE",
};

const colorClass: Record<JobStatus, string> = {
  queued: "text-muted",
  running: "text-glow",
  needs_input: "text-alert",
  failed: "text-danger",
  cancelled: "text-muted",
  done: "text-muted",
};

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span className={`text-[10px] font-mono tracking-wider ${colorClass[status]}`}>
      {threadStatusLabel[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: JobStatus }) {
  if (status === "running") {
    return (
      <span className="relative inline-flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glow opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-glow shadow-[var(--shadow-glow)]" />
      </span>
    );
  }
  if (status === "needs_input") {
    return (
      <span className="relative inline-flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alert opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-alert" />
      </span>
    );
  }
  if (status === "failed") {
    // Distinct: square, no pulse, danger red with hard shadow
    return (
      <span
        className="inline-flex size-2 rotate-45 bg-danger shadow-[var(--shadow-danger)]"
        aria-label="failed"
      />
    );
  }
  return <span className="inline-flex size-2 rounded-full bg-muted/60" />;
}
