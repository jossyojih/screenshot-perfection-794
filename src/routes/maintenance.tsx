import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock3,
  Eye,
  HardDrive,
  LoaderCircle,
  Play,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { authenticatedFetch } from "@/lib/api";

export const Route = createFileRoute("/maintenance")({
  head: () => ({ meta: [{ title: "Storage & Maintenance — Command Center" }] }),
  component: MaintenancePage,
});

interface MaintenanceStatus {
  cleanupEnabled: boolean;
  lastRunAt?: string;
  lastRunCompletedAt?: string;
  nextRunAt?: string;
  isRunning: boolean;
  eligibleWorktrees: number;
  protectedWorktrees: number;
  lastCleanedCount: number;
  lastFailedCount: number;
  totalReclaimedBytes: number;
  diskUsageBytes?: number;
  retainedWorktreeCount: number;
  retainedWorktreeBytes?: number;
  archivedThreads: number;
}

interface WorktreeSummary {
  jobId: string;
  repositoryId: string;
  reason: string;
}

interface CleanupPreview {
  retainedWorktreeCount: number;
  classifiedWorktreeCount: number;
  eligible: Array<WorktreeSummary & { estimatedBytes: number }>;
  protectedWorktrees: WorktreeSummary[];
  generatedAt?: string;
}

interface CleanupHistory {
  cleaned: Array<WorktreeSummary & { reclaimedBytes: number; cleanedAt: string }>;
  failed: Array<WorktreeSummary & { errorCode: string; failedAt: string }>;
}

const MAINTENANCE_REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(MAINTENANCE_REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  let response: Response;
  try {
    response = await authenticatedFetch(path, { ...init, signal });
  } catch (error) {
    if (timeoutSignal.aborted) throw new Error("The maintenance request timed out. Try again.");
    throw error;
  }
  if (!response.ok) {
    let message =
      response.status === 401
        ? "Your session has expired. Sign in again."
        : `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // Keep the safe status-based message; never display a raw response.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

const formatBytes = (bytes?: number) => {
  if (bytes === undefined) return "Unavailable";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
};

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not yet";

function MaintenancePage() {
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const previewSubmitting = useRef(false);
  const status = useQuery({
    queryKey: ["maintenance", "status"],
    queryFn: ({ signal }) => request<MaintenanceStatus>("/maintenance/status", { signal }),
    refetchInterval: (query) => (query.state.data?.isRunning ? 2_000 : 10_000),
    retry: 0,
  });
  const preview = useQuery({
    queryKey: ["maintenance", "preview"],
    queryFn: ({ signal }) => request<CleanupPreview>("/maintenance/preview", { signal }),
    retry: 0,
  });
  const history = useQuery({
    queryKey: ["maintenance", "history"],
    queryFn: ({ signal }) => request<CleanupHistory>("/maintenance/history", { signal }),
    retry: 0,
  });
  const freshPreview = useMutation({
    mutationFn: () => request<CleanupPreview>("/maintenance/preview", { method: "POST" }),
    onMutate: () => {
      previewSubmitting.current = true;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["maintenance", "preview"], result);
      void queryClient.invalidateQueries({ queryKey: ["maintenance", "status"] });
    },
    onSettled: () => {
      previewSubmitting.current = false;
    },
  });
  const cleanup = useMutation({
    mutationFn: () => request<{ started: true }>("/maintenance/cleanup", { method: "POST" }),
    onMutate: () => {
      submitting.current = true;
    },
    onSettled: async () => {
      submitting.current = false;
      await queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });

  const runCleanup = () => {
    if (
      submitting.current ||
      cleanup.isPending ||
      status.data?.isRunning ||
      !status.data?.cleanupEnabled
    )
      return;
    cleanup.mutate();
  };
  const runPreview = () => {
    if (previewSubmitting.current || freshPreview.isPending || running) return;
    freshPreview.mutate();
  };

  if (status.isPending) {
    return (
      <AppShell title="Storage & Maintenance">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
          <LoadingState label="Loading storage and maintenance status…" />
        </div>
      </AppShell>
    );
  }

  if (status.isError) {
    return (
      <AppShell title="Storage & Maintenance">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
          <ErrorState error={status.error} retry={() => status.refetch()} />
        </div>
      </AppShell>
    );
  }

  const running = status.data.isRunning || cleanup.isPending;
  const eligible = preview.data?.eligible ?? [];
  const protectedWorktrees = preview.data?.protectedWorktrees ?? [];
  const retainedWorktreeCount =
    preview.data?.retainedWorktreeCount ?? status.data.retainedWorktreeCount;
  const classificationMismatch =
    preview.data !== undefined &&
    preview.data.classifiedWorktreeCount !== preview.data.retainedWorktreeCount;
  const historyItems = [
    ...(history.data?.cleaned.map((item) => ({
      ...item,
      kind: "cleaned" as const,
      at: item.cleanedAt,
    })) ?? []),
    ...(history.data?.failed.map((item) => ({
      ...item,
      kind: "failed" as const,
      at: item.failedAt,
    })) ?? []),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 10);

  return (
    <AppShell title="Storage & Maintenance">
      <div className="mx-auto w-full max-w-6xl overflow-hidden px-4 py-8 lg:px-8">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Storage & maintenance</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Review retained worktrees and the server-controlled cleanup schedule.
            </p>
          </div>
          <span
            className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              status.data.cleanupEnabled
                ? "border-glow/30 bg-glow-soft text-glow"
                : "border-edge bg-surface text-muted"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${status.data.cleanupEnabled ? "bg-glow" : "bg-muted"}`}
            />
            Cleanup {status.data.cleanupEnabled ? "enabled" : "disabled"}
          </span>
        </div>

        {!status.data.cleanupEnabled && (
          <div role="status" className="mt-5 rounded-xl border border-edge bg-surface p-4 text-sm">
            <div className="font-medium">Cleanup is disabled by server policy</div>
            <p className="mt-1 text-muted">
              Preview remains available, but cleanup cannot be started from this app.
            </p>
          </div>
        )}

        <dl className="mt-6 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<HardDrive />}
            label="Runs-root usage"
            value={formatBytes(status.data.diskUsageBytes)}
            detail={`${retainedWorktreeCount} retained worktrees`}
          />
          <Metric
            icon={<Trash2 />}
            label="Eligible worktrees"
            value={preview.data?.generatedAt ? String(eligible.length) : "—"}
            detail={
              preview.data?.generatedAt
                ? formatBytes(eligible.reduce((sum, item) => sum + item.estimatedBytes, 0))
                : "No cached preview"
            }
          />
          <Metric
            icon={<ShieldCheck />}
            label="Protected worktrees"
            value={preview.data?.generatedAt ? String(protectedWorktrees.length) : "—"}
            detail={preview.data?.generatedAt ? "Every item has a reason" : "No cached preview"}
          />
          <Metric
            icon={<Archive />}
            label="Archived threads"
            value={String(status.data.archivedThreads)}
            detail="Retention policy preserved"
          />
        </dl>

        {classificationMismatch && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-danger/50 bg-danger-soft p-4 text-sm"
          >
            <div className="font-medium text-danger">Preview count mismatch</div>
            <p className="mt-1 text-muted">
              {preview.data.classifiedWorktreeCount} of {preview.data.retainedWorktreeCount}{" "}
              retained worktrees were classified. Retry the preview; cleanup remains unavailable.
            </p>
            <button
              type="button"
              onClick={() => preview.refetch()}
              className="mt-3 rounded-md border border-danger/50 px-3 py-2 text-xs"
            >
              Retry preview
            </button>
          </div>
        )}

        <section className="mt-6 rounded-xl border border-edge bg-surface p-4 sm:p-5">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ScheduleItem label="Last started" value={formatDate(status.data.lastRunAt)} />
            <ScheduleItem
              label="Last completed"
              value={formatDate(status.data.lastRunCompletedAt)}
            />
            <ScheduleItem label="Next scheduled run" value={formatDate(status.data.nextRunAt)} />
            <ScheduleItem
              label="Last result"
              value={`${status.data.lastCleanedCount} cleaned · ${status.data.lastFailedCount} failed`}
            />
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={runPreview}
              disabled={freshPreview.isPending || running}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-edge px-4 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {freshPreview.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Eye className="size-4" />
              )}
              {freshPreview.isPending ? "Previewing…" : "Preview cleanup"}
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={
                    !status.data.cleanupEnabled ||
                    running ||
                    eligible.length === 0 ||
                    classificationMismatch
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-glow px-4 text-xs font-bold text-void disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {running ? "Cleanup running" : "Run cleanup"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Run cleanup now?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The server will remove up to {eligible.length} currently eligible worktrees
                    according to its batch and retention policies. Protected worktrees and archived
                    threads still within retention are not removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={running} onClick={runCleanup}>
                    Confirm cleanup
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="mt-3 text-xs text-muted">
            Displayed preview generated {formatDate(preview.data?.generatedAt)}.
          </p>
          {freshPreview.isError && (
            <div role="alert" className="mt-3 text-sm text-danger">
              <p>{freshPreview.error.message}</p>
              <button
                type="button"
                onClick={runPreview}
                disabled={freshPreview.isPending}
                className="mt-2 rounded-md border border-danger/50 px-3 py-2 text-xs disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}
          {cleanup.isError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {cleanup.error.message}
            </p>
          )}
          {cleanup.isSuccess && (
            <p role="status" className="mt-3 text-sm text-glow">
              Cleanup started. Status will refresh automatically.
            </p>
          )}
        </section>

        <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
          <WorktreeList
            title="Eligible worktrees"
            description="Safe to remove under current server policy."
            query={preview}
            items={eligible}
            eligible
          />
          <WorktreeList
            title="Protected worktrees"
            description="Kept for the reason shown on every item."
            query={preview}
            items={protectedWorktrees}
          />
        </div>

        <section className="mt-6 min-w-0 rounded-xl border border-edge bg-surface p-4 sm:p-5">
          <h3 className="font-medium">Recent cleanup history</h3>
          <p className="mt-1 text-xs text-muted">
            Cleanup results are shown without filesystem details or raw output.
          </p>
          <div className="mt-4">
            {history.isPending ? (
              <LoadingState label="Loading cleanup history…" />
            ) : history.isError ? (
              <ErrorState error={history.error} retry={() => history.refetch()} />
            ) : historyItems.length === 0 ? (
              <DataState title="No cleanup history yet." />
            ) : (
              <div className="space-y-2">
                {historyItems.map((item) => (
                  <div
                    key={`${item.kind}-${item.jobId}-${item.repositoryId}-${item.at}`}
                    className="flex min-w-0 flex-col gap-2 rounded-lg border border-edge p-3 sm:flex-row sm:items-center"
                  >
                    {item.kind === "cleaned" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-glow" />
                    ) : (
                      <AlertCircle className="size-4 shrink-0 text-danger" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm">
                        {item.kind === "cleaned"
                          ? item.reason
                          : `Cleanup failed (${item.errorCode})`}
                      </div>
                      <div className="mt-1 break-all text-[10px] font-mono text-muted">
                        Job {item.jobId} · repository {item.repositoryId}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-muted">
                      {item.kind === "cleaned" && `${formatBytes(item.reclaimedBytes)} · `}
                      {formatDate(item.at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-edge bg-surface p-4">
      <dt className="flex items-center gap-2 text-xs text-muted">
        <span className="[&>svg]:size-4">{icon}</span>
        {label}
      </dt>
      <dd className="mt-3 break-words text-2xl font-semibold">{value}</dd>
      <div className="mt-1 break-words text-xs text-muted">{detail}</div>
    </div>
  );
}

function ScheduleItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted">
        <Clock3 className="size-3" />
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm">{value}</dd>
    </div>
  );
}

function WorktreeList({
  title,
  description,
  query,
  items,
  eligible = false,
}: {
  title: string;
  description: string;
  query: ReturnType<typeof useQuery<CleanupPreview>>;
  items: Array<WorktreeSummary & { estimatedBytes?: number }>;
  eligible?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-edge bg-surface p-4 sm:p-5">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-xs text-muted">{description}</p>
      <div className="mt-4">
        {query.isPending ? (
          <LoadingState label={`Loading ${title.toLowerCase()}…`} />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : !query.data?.generatedAt ? (
          <DataState title="No cached preview yet. Press Preview cleanup to generate one." />
        ) : items.length === 0 ? (
          <DataState title={`No ${title.toLowerCase()}.`} />
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
            {items.map((item) => (
              <article
                key={`${item.jobId}-${item.repositoryId}`}
                className="min-w-0 rounded-lg border border-edge p-3"
              >
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="break-words text-sm">{item.reason}</div>
                    <div className="mt-1 break-all text-[10px] font-mono text-muted">
                      Job {item.jobId} · repository {item.repositoryId}
                    </div>
                  </div>
                  {eligible && (
                    <span className="shrink-0 text-xs text-muted">
                      {formatBytes(item.estimatedBytes)}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {query.isFetching && !query.isPending && (
          <p role="status" className="mt-3 text-xs text-muted">
            Refreshing preview…
          </p>
        )}
      </div>
    </section>
  );
}
