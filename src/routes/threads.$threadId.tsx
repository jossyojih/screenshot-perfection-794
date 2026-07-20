import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import {
  cancelJob,
  errorMessage,
  formatTime,
  getJob,
  getProject,
  jobTitle,
  projectRepositories,
  replyToJob,
  type JobEvent,
} from "@/lib/api";
export const Route = createFileRoute("/threads/$threadId")({
  head: () => ({ meta: [{ title: "Job — Command Center" }] }),
  component: ThreadPage,
});

function useJobEvents(jobId: string, active: boolean) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [streamError, setStreamError] = useState<string>();
  useEffect(() => {
    setEvents([]);
    setStreamError(undefined);
    const source = new EventSource(`/api/runner/jobs/${encodeURIComponent(jobId)}/events`);
    const add = (message: MessageEvent) => {
      try {
        const parsed = JSON.parse(message.data) as JobEvent;
        setEvents((current) => {
          const key =
            parsed.id ??
            `${parsed.timestamp ?? parsed.createdAt}:${parsed.type ?? parsed.event}:${message.data}`;
          return current.some(
            (item) =>
              (item.id ??
                `${item.timestamp ?? item.createdAt}:${item.type ?? item.event}:${JSON.stringify(item)}`) ===
              key,
          )
            ? current
            : [...current, parsed];
        });
      } catch {
        setEvents((current) => [...current, { type: message.type, message: message.data }]);
      }
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    };
    source.onmessage = add;
    for (const name of ["status", "log", "message", "result", "usage", "needs_input", "completed"])
      source.addEventListener(name, add as EventListener);
    source.onerror = (event) => {
      if (event instanceof MessageEvent && event.data) add(event);
      else if (active) setStreamError("Live updates disconnected. Reconnecting…");
    };
    return () => source.close();
  }, [jobId, active, queryClient]);
  return { events, streamError };
}

function ThreadPage() {
  const { threadId } = Route.useParams();
  const queryClient = useQueryClient();
  const job = useQuery({
    queryKey: ["job", threadId],
    queryFn: () => getJob(threadId),
    refetchInterval: (q) =>
      ["queued", "running", "needs_input"].includes(q.state.data?.status ?? "") ? 5000 : false,
  });
  const project = useQuery({
    queryKey: ["project", job.data?.projectId],
    queryFn: () => getProject(job.data!.projectId),
    enabled: Boolean(job.data?.projectId),
  });
  const active = ["queued", "running", "needs_input"].includes(job.data?.status ?? "");
  const { events, streamError } = useJobEvents(threadId, active);
  const [reply, setReply] = useState("");
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["job", threadId] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  };
  const cancel = useMutation({ mutationFn: () => cancelJob(threadId), onSuccess: refresh });
  const sendReply = useMutation({
    mutationFn: () => replyToJob(threadId, reply.trim()),
    onSuccess: () => {
      setReply("");
      refresh();
    },
  });
  const repoNames = useMemo(
    () =>
      new Map(
        projectRepositories(project.data ?? { id: "", name: "", repositories: [] }).map((r) => [
          r.id,
          r.name,
        ]),
      ),
    [project.data],
  );
  if (job.isPending)
    return (
      <AppShell title="Job">
        <Page>
          <LoadingState />
        </Page>
      </AppShell>
    );
  if (job.isError)
    return (
      <AppShell title="Job">
        <Page>
          <ErrorState error={job.error} retry={() => job.refetch()} />
        </Page>
      </AppShell>
    );
  const j = job.data;
  return (
    <AppShell
      title={project.data?.name ?? "Job"}
      headerRight={
        <Link to="/" className="text-[10px] font-mono uppercase tracking-widest text-muted">
          ← Feed
        </Link>
      }
    >
      <Page>
        <section className="rounded-xl border border-edge bg-surface/50 p-4 lg:p-6">
          <div className="mb-2 flex items-center gap-2">
            <StatusDot status={j.status} />
            <StatusPill status={j.status} />
            <span className="text-[10px] font-mono text-muted">· {j.agent}</span>
          </div>
          <h1 className="text-lg font-semibold leading-tight lg:text-2xl">{jobTitle(j)}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {j.selectedRepositoryIds.map((id) => (
              <span
                key={id}
                className="rounded border border-edge bg-void/60 px-2 py-1 text-[9px] font-mono text-muted"
              >
                {repoNames.get(id) ?? id}
              </span>
            ))}
            <span className="text-[9px] font-mono text-muted">
              updated {formatTime(j.updatedAt ?? j.createdAt)}
            </span>
          </div>
        </section>
        {(j.status === "queued" || j.status === "running") && (
          <section className="rounded-lg border border-glow/30 bg-glow-soft p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-glow">
                  Agent is working
                </div>
                <p className="mt-1 text-xs text-muted">Live events will appear below.</p>
              </div>
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="rounded-md border border-danger/50 px-3 py-2 text-[10px] font-mono uppercase text-danger disabled:opacity-50"
              >
                {cancel.isPending ? "Cancelling…" : "Cancel job"}
              </button>
            </div>
          </section>
        )}
        {j.status === "needs_input" && (
          <section className="rounded-lg border border-alert/40 bg-alert-soft p-4">
            <div className="mb-2 text-[10px] font-mono uppercase tracking-widest text-alert">
              Needs input
            </div>
            {j.question && <p className="mb-3 text-sm">{j.question}</p>}
            <div className="flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && reply.trim()) sendReply.mutate();
                }}
                placeholder="Type your reply…"
                className="h-10 min-w-0 flex-1 rounded-md border border-edge bg-void px-3 text-xs focus:border-alert/60 focus:outline-none"
              />
              <button
                onClick={() => sendReply.mutate()}
                disabled={!reply.trim() || sendReply.isPending}
                className="rounded-md bg-foreground px-4 text-[10px] font-mono uppercase text-void disabled:bg-edge"
              >
                Send
              </button>
            </div>
          </section>
        )}
        {(cancel.isError || sendReply.isError) && (
          <ErrorState error={cancel.error ?? sendReply.error} />
        )}
        {streamError && active && (
          <div className="rounded-lg border border-alert/30 bg-alert-soft p-3 text-xs text-alert">
            {streamError}
          </div>
        )}
        <section className="rounded-xl border border-edge bg-surface/40 p-4 lg:p-6">
          <h2 className="mb-3 text-[11px] font-mono uppercase tracking-widest text-muted">
            Activity
          </h2>
          {events.length === 0 ? (
            <DataState
              title={
                active ? "Waiting for runner events…" : "No events were recorded for this job."
              }
            />
          ) : (
            <ol className="ml-1 space-y-5 border-l border-edge pl-5">
              {events.map((event, i) => (
                <EventRow key={event.id ?? i} event={event} />
              ))}
            </ol>
          )}
        </section>
        {(j.finalResponse || j.status === "done") && (
          <section className="rounded-lg border border-edge bg-surface p-4">
            <h2 className="mb-2 text-[10px] font-mono uppercase tracking-widest text-glow">
              Final response
            </h2>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {j.finalResponse ?? "Job completed without a final response."}
            </div>
          </section>
        )}
        {j.error && (
          <section className="rounded-lg border-2 border-danger/60 bg-danger-soft p-4">
            <h2 className="mb-2 text-[10px] font-mono uppercase tracking-widest text-danger">
              Error
            </h2>
            <p className="whitespace-pre-wrap text-sm">
              {typeof j.error === "string"
                ? j.error
                : (j.error.message ?? JSON.stringify(j.error, null, 2))}
            </p>
          </section>
        )}
        {j.repositoryResults && j.repositoryResults.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-mono uppercase tracking-widest text-muted">
              Repository_Results
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {j.repositoryResults.map((result, i) => (
                <div
                  key={result.repositoryId ?? i}
                  className="rounded-xl border border-edge bg-surface p-4"
                >
                  <div className="text-sm font-medium">
                    {result.repositoryName ??
                      repoNames.get(result.repositoryId ?? "") ??
                      result.repositoryId ??
                      `Repository ${i + 1}`}
                  </div>
                  {result.status && (
                    <div className="mt-1 text-[9px] font-mono uppercase text-glow">
                      {result.status}
                    </div>
                  )}
                  {result.summary && (
                    <p className="mt-3 whitespace-pre-wrap text-xs text-muted">{result.summary}</p>
                  )}
                  {result.error && <p className="mt-3 text-xs text-danger">{result.error}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
        {j.usage && (
          <section className="rounded-xl border border-edge bg-surface/60 p-4">
            <h2 className="mb-3 text-[11px] font-mono uppercase tracking-widest text-muted">
              Usage
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(j.usage).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-edge bg-void/60 p-3">
                  <div className="text-[9px] font-mono uppercase text-muted">
                    {key.replace(/([A-Z])/g, " $1")}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{String(value)}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </Page>
    </AppShell>
  );
}
function EventRow({ event }: { event: JobEvent }) {
  const kind = event.type ?? event.event ?? "event";
  const raw = event.message ?? event.data ?? event;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
  return (
    <li className="relative">
      <span
        className={`absolute -left-[26px] top-1.5 size-2 ring-4 ring-void ${kind.includes("error") ? "rotate-45 bg-danger" : kind.includes("input") ? "rounded-full bg-alert" : "rounded-full bg-glow"}`}
      />
      <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted">
        {formatTime(event.timestamp ?? event.createdAt)} · {kind}
      </div>
      <div className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/85">
        {text}
      </div>
    </li>
  );
}
const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-5 lg:px-8 lg:py-8">{children}</div>
);
