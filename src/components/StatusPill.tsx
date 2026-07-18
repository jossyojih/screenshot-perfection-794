import type { ThreadStatus } from "@/lib/mock-data";

const label: Record<ThreadStatus, string> = {
  running: "RUNNING",
  needs_input: "NEEDS INPUT",
  failed: "FAILED",
  done: "DONE",
};

const colorClass: Record<ThreadStatus, string> = {
  running: "text-glow",
  needs_input: "text-alert",
  failed: "text-danger",
  done: "text-muted",
};

export function StatusPill({ status }: { status: ThreadStatus }) {
  return (
    <span className={`text-[10px] font-mono tracking-wider ${colorClass[status]}`}>
      {label[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: ThreadStatus }) {
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
