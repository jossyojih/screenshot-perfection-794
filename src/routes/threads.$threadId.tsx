import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import {
  cancelJob,
  continueJob,
  errorMessage,
  formatTime,
  getJob,
  getConversation,
  getProject,
  jobTitle,
  projectRepositories,
  replyToJob,
  type Job,
  type JobEvent,
  authenticatedFetch,
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
    const controller = new AbortController();
    let lastEventId = "";
    let retryDelay = 1500;
    const add = (data: string, eventType = "message", id = "") => {
      try {
        const parsed = JSON.parse(data) as JobEvent;
        if (id && !parsed.id) parsed.id = id;
        if (eventType !== "message" && !parsed.type && !parsed.event) parsed.type = eventType;
        setEvents((current) => {
          const key =
            parsed.id ??
            `${parsed.timestamp ?? parsed.createdAt}:${parsed.type ?? parsed.event}:${data}`;
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
        setEvents((current) => [
          ...current,
          { id: id || undefined, type: eventType, message: data },
        ]);
      }
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    };
    const parseBlock = (block: string) => {
      let eventType = "message";
      let id: string | undefined;
      const data: string[] = [];
      for (const line of block.split(/\r\n|\r|\n/)) {
        if (!line || line.startsWith(":")) continue;
        const separator = line.indexOf(":");
        const field = separator < 0 ? line : line.slice(0, separator);
        let value = separator < 0 ? "" : line.slice(separator + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "event") eventType = value;
        else if (field === "id" && !value.includes("\0")) id = value;
        else if (field === "retry" && /^\d+$/.test(value))
          retryDelay = Math.max(500, Number(value));
        else if (field === "data") data.push(value);
      }
      if (id !== undefined) lastEventId = id;
      if (data.length) add(data.join("\n"), eventType || "message", id ?? "");
    };
    const connect = async () => {
      while (!controller.signal.aborted) {
        try {
          const response = await authenticatedFetch(`/jobs/${encodeURIComponent(jobId)}/events`, {
            signal: controller.signal,
            headers: {
              Accept: "text/event-stream",
              ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
            },
          });
          if (!response.ok) throw new Error(`Live updates failed (${response.status})`);
          if (!response.body) throw new Error("Live updates are unavailable");
          setStreamError(undefined);
          retryDelay = 1500;
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = "";
          try {
            while (!controller.signal.aborted) {
              const { value, done } = await reader.read();
              if (done) {
                if (buffer) parseBlock(buffer);
                break;
              }
              buffer += value;
              let match: RegExpExecArray | null;
              while ((match = /\r\n\r\n|\r\r|\n\n/.exec(buffer))) {
                parseBlock(buffer.slice(0, match.index));
                buffer = buffer.slice(match.index + match[0].length);
              }
            }
          } finally {
            reader.releaseLock();
          }
        } catch (error) {
          if (controller.signal.aborted) break;
          if (error instanceof Error && error.message.includes("401")) {
            setStreamError("Session expired.");
            break;
          }
          setStreamError(
            active ? "Live updates disconnected. Reconnecting…" : "Live event replay unavailable.",
          );
        }
        if (!active || controller.signal.aborted) break;
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(() => {
            controller.signal.removeEventListener("abort", onAbort);
            resolve();
          }, retryDelay);
          const onAbort = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          controller.signal.addEventListener("abort", onAbort, { once: true });
        });
        retryDelay = Math.min(retryDelay * 2, 15000);
      }
    };
    void connect();
    return () => controller.abort();
  }, [jobId, active, queryClient]);
  return { events, streamError };
}

function ThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
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
  const conversation = useQuery({
    queryKey: ["conversation", threadId],
    queryFn: () => getConversation(threadId),
  });
  const active = ["queued", "running", "needs_input"].includes(job.data?.status ?? "");
  const { events, streamError } = useJobEvents(threadId, active);
  const [activityExpanded, setActivityExpanded] = useState(() =>
    ["queued", "running", "needs_input"].includes(job.data?.status ?? ""),
  );
  const [reply, setReply] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [followUpRequestId, setFollowUpRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    const status = job.data?.status;
    if (status === "queued" || status === "running") setActivityExpanded(true);
    if (status === "done" || status === "failed" || status === "cancelled")
      setActivityExpanded(false);
  }, [job.data?.status]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["job", threadId] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["conversation", threadId] });
  };
  const cancel = useMutation({ mutationFn: () => cancelJob(threadId), onSuccess: refresh });
  const sendReply = useMutation({
    mutationFn: () => replyToJob(threadId, reply.trim()),
    onSuccess: () => {
      setReply("");
      refresh();
    },
  });
  const sendFollowUp = useMutation({
    mutationFn: () => continueJob(threadId, followUp.trim(), followUpRequestId),
    onSuccess: (created) => {
      setFollowUp("");
      setFollowUpRequestId(crypto.randomUUID());
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void navigate({ to: "/threads/$threadId", params: { threadId: created.id } });
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
  const j = mergeJobEvents(job.data, events);
  const earlierRuns = (conversation.data ?? []).filter((run) => run.id !== j.id);
  const canContinue =
    ["done", "failed", "cancelled"].includes(j.status) &&
    (!conversation.data || conversation.data.at(-1)?.id === j.id);
  const completed = ["done", "failed", "cancelled"].includes(j.status);
  const activityId = `job-activity-${j.id}`;
  const finalResponse = (j.finalResponse || j.status === "done") && (
    <section className="rounded-lg border border-edge bg-surface p-4">
      <h2 className="mb-2 text-[10px] font-mono uppercase tracking-widest text-glow">
        Final response
      </h2>
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {j.finalResponse ?? "Job completed without a final response."}
      </div>
    </section>
  );
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
        {earlierRuns.length > 0 && (
          <section className="rounded-xl border border-edge bg-surface/40 p-4 lg:p-6">
            <h2 className="mb-3 text-[11px] font-mono uppercase tracking-widest text-muted">
              Earlier conversation runs
            </h2>
            <div className="space-y-3">
              {earlierRuns.map((run) => (
                <Link
                  key={run.id}
                  to="/threads/$threadId"
                  params={{ threadId: run.id }}
                  className="block rounded-lg border border-edge bg-void/50 p-3 hover:border-glow/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={run.status} />
                    <span className="text-[10px] font-mono text-muted">{run.agent}</span>
                    {run.selectedRepositoryIds.map((id) => (
                      <span key={id} className="text-[9px] font-mono text-muted">
                        {repoNames.get(id) ?? id}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm">{run.prompt}</p>
                  {run.finalResponse && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted">{run.finalResponse}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
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
        {(cancel.isError || sendReply.isError || sendFollowUp.isError) && (
          <ErrorState error={cancel.error ?? sendReply.error ?? sendFollowUp.error} />
        )}
        {streamError && active && (
          <div className="rounded-lg border border-alert/30 bg-alert-soft p-3 text-xs text-alert">
            {streamError}
          </div>
        )}
        {completed && finalResponse}
        <section className="overflow-hidden rounded-xl border border-edge bg-surface/40">
          <h2>
            <button
              type="button"
              aria-expanded={activityExpanded}
              aria-controls={activityId}
              onClick={() => setActivityExpanded((expanded) => !expanded)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[11px] font-mono uppercase tracking-widest text-muted hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-glow/60 lg:px-6"
            >
              <span>
                Activity · {events.length} {events.length === 1 ? "event" : "events"}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`size-4 shrink-0 transition-transform ${activityExpanded ? "rotate-180" : ""}`}
              />
            </button>
          </h2>
          <div id={activityId} hidden={!activityExpanded} className="px-4 pb-4 lg:px-6 lg:pb-6">
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
          </div>
        </section>
        {!completed && finalResponse}
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
        {canContinue && (
          <section className="sticky bottom-3 rounded-xl border border-glow/40 bg-void/95 p-4 shadow-xl backdrop-blur lg:p-5">
            <h2 className="mb-2 text-[10px] font-mono uppercase tracking-widest text-glow">
              Continue conversation
            </h2>
            <p className="mb-3 text-xs text-muted">
              Keeps the same {j.agent} agent and repository scope in a linked run.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value)}
                rows={3}
                placeholder="Ask a follow-up…"
                className="min-w-0 flex-1 resize-y rounded-md border border-edge bg-surface px-3 py-2 text-sm focus:border-glow/60 focus:outline-none"
              />
              <button
                onClick={() => sendFollowUp.mutate()}
                disabled={!followUp.trim() || sendFollowUp.isPending}
                className="min-h-10 rounded-md bg-foreground px-5 text-[10px] font-mono uppercase text-void disabled:bg-edge sm:self-end"
              >
                {sendFollowUp.isPending ? "Sending…" : "Continue"}
              </button>
            </div>
          </section>
        )}
      </Page>
    </AppShell>
  );
}

export function mergeJobEvents(job: Job, events: JobEvent[]): Job {
  let finalResponse = job.finalResponse;
  let usage = job.usage;
  let error = job.error;
  let question = job.question;
  const repositoryResults = job.repositoryResults ? [...job.repositoryResults] : [];
  for (const event of events) {
    const kind = event.type ?? event.event;
    const data =
      event.data && typeof event.data === "object" && !Array.isArray(event.data)
        ? (event.data as Record<string, unknown>)
        : undefined;
    if (kind === "final_response") finalResponse = event.message;
    if (kind === "token_usage" && data) usage = data;
    if (kind === "repository_result" && data) {
      const repositoryId = typeof data.repositoryId === "string" ? data.repositoryId : undefined;
      const index = repositoryId
        ? repositoryResults.findIndex((result) => result.repositoryId === repositoryId)
        : -1;
      if (index >= 0) repositoryResults[index] = data;
      else repositoryResults.push(data);
    }
    if (kind === "error") error = typeof data?.error === "string" ? data.error : event.message;
    if (kind === "question" || kind === "needs_input" || typeof data?.question === "string")
      question = typeof data?.question === "string" ? data.question : event.message;
  }
  return { ...job, finalResponse, usage, error, question, repositoryResults };
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
