import type { ReactNode } from "react";

export function DataState({
  children,
  title = "Nothing here yet",
}: {
  children?: ReactNode;
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-edge p-8 text-center text-sm text-muted">
      {children ?? title}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-3" aria-live="polite">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl border border-edge bg-surface/60" />
      ))}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message = error instanceof Error ? error.message : "The data could not be loaded.";
  return (
    <div className="rounded-xl border border-danger/50 bg-danger-soft p-5 text-sm">
      <div className="font-medium text-danger">Unable to load data</div>
      <p className="mt-1 text-muted">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-3 rounded-md border border-danger/50 px-3 py-2 text-xs"
        >
          Try again
        </button>
      )}
    </div>
  );
}
