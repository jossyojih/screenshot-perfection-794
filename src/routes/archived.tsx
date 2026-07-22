import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { errorMessage, getArchivedThreads, getProjects, restoreThread } from "@/lib/api";

const exactTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "long" }).format(
    new Date(value),
  );

export const Route = createFileRoute("/archived")({
  head: () => ({ meta: [{ title: "Archived Threads — Command Center" }] }),
  component: ArchivedThreadsPage,
});

function ArchivedThreadsPage() {
  const queryClient = useQueryClient();
  const archived = useQuery({ queryKey: ["archived-threads"], queryFn: getArchivedThreads });
  const projects = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const [restored, setRestored] = useState<string>();
  const restore = useMutation({
    mutationFn: restoreThread,
    onSuccess: (_, id) => {
      setRestored(id);
      queryClient.invalidateQueries({ queryKey: ["archived-threads"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
  const names = new Map((projects.data ?? []).map((project) => [project.id, project.name]));
  return (
    <AppShell title="Archived Threads">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
        <h2 className="text-xl font-semibold">Archived threads</h2>
        <p className="mt-1 text-sm text-muted">
          Restore a conversation during its 7-day grace period.
        </p>
        {restored && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-glow/30 bg-glow-soft p-3 text-sm text-glow"
          >
            Thread restored successfully.
          </p>
        )}
        {restore.isError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger"
          >
            {errorMessage(restore.error)}
          </p>
        )}
        <div className="mt-6 space-y-3">
          {archived.isPending ? (
            <LoadingState />
          ) : archived.isError ? (
            <ErrorState error={archived.error} retry={() => archived.refetch()} />
          ) : archived.data.length === 0 ? (
            <DataState title="No archived threads." />
          ) : (
            archived.data.map((thread) => (
              <article
                key={thread.threadId}
                className="rounded-xl border border-edge bg-surface p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
                      {names.get(thread.projectId) ?? thread.projectId} · {thread.runCount}{" "}
                      {thread.runCount === 1 ? "run" : "runs"}
                    </div>
                    <h3 className="mt-1 break-words font-medium">{thread.title}</h3>
                    <dl className="mt-3 grid gap-1 text-xs font-mono text-muted">
                      <div>
                        <dt className="inline">Archived: </dt>
                        <dd className="inline">{exactTime(thread.archivedAt)}</dd>
                      </div>
                      <div>
                        <dt className="inline">Permanent deletion: </dt>
                        <dd className="inline text-danger">{exactTime(thread.purgeAfter)}</dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    type="button"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate(thread.threadId)}
                    className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-glow/30 px-3 text-xs text-glow disabled:opacity-50"
                  >
                    {restore.isPending && restore.variables === thread.threadId ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <ArchiveRestore className="size-4" />
                    )}{" "}
                    Restore
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
