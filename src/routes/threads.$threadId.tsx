import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  GitCommitHorizontal,
  GitPullRequest,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import {
  cancelJob,
  decideJobScope,
  continueJob,
  errorMessage,
  formatTime,
  getJob,
  getConversation,
  getProject,
  getJobChanges,
  getJobDeployments,
  jobTitle,
  projectRepositories,
  replyToJob,
  promoteJob,
  type JobChanges,
  type Job,
  type JobEvent,
  authenticatedFetch,
  type Deployment,
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
  const [followUpScope, setFollowUpScope] = useState<"keep" | "auto" | "manual">("keep");
  const [followUpRepositories, setFollowUpRepositories] = useState<string[]>([]);
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
  const scopeDecision = useMutation({
    mutationFn: (input: { decision: "approve" | "reject" | "choose"; ids?: string[] }) =>
      decideJobScope(threadId, input.decision, input.ids),
    onSuccess: refresh,
  });
  const sendFollowUp = useMutation({
    mutationFn: () =>
      continueJob(
        threadId,
        followUp.trim(),
        followUpRequestId,
        followUpScope === "keep"
          ? undefined
          : {
              scopeMode: followUpScope,
              requestedRepositoryIds: followUpScope === "manual" ? followUpRepositories : undefined,
            },
      ),
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
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (j.projectId) {
      void navigate({
        to: "/projects/$projectId",
        params: { projectId: j.projectId },
      });
      return;
    }
    void navigate({ to: "/" });
  };
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
        <button
          type="button"
          onClick={goBack}
          className="text-[10px] font-mono uppercase tracking-widest text-muted"
        >
          ← Back
        </button>
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
          <RequestPanel prompt={j.prompt} className="mt-4" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded border border-glow/30 bg-glow-soft px-2 py-1 text-[9px] font-mono uppercase text-glow">
              {j.scopeMode ?? "manual"} scope
            </span>
            <span className="text-[9px] font-mono text-muted">
              updated {formatTime(j.updatedAt ?? j.createdAt)}
            </span>
          </div>
        </section>
        <section className="grid gap-3 rounded-xl border border-edge bg-surface/50 p-4 md:grid-cols-2 lg:p-6">
          <ScopeList
            title="Requested scope"
            ids={j.requestedRepositoryIds ?? j.selectedRepositoryIds}
            names={repoNames}
            empty="No repositories requested; the planner chooses the minimum scope."
          />
          <ScopeList
            title="Resolved scope"
            ids={j.resolvedRepositoryIds ?? j.selectedRepositoryIds}
            names={repoNames}
            reasons={j.scopeReasons}
            empty="Scope planning is pending."
          />
        </section>
        {earlierRuns.length > 0 && (
          <section className="rounded-xl border border-edge bg-surface/40 p-4 lg:p-6">
            <h2 className="mb-3 text-[11px] font-mono uppercase tracking-widest text-muted">
              Earlier conversation runs
            </h2>
            <div className="space-y-3">
              {earlierRuns.map((run) => (
                <article key={run.id} className="rounded-lg border border-edge bg-void/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={run.status} />
                    <span className="text-[10px] font-mono text-muted">{run.agent}</span>
                    {run.selectedRepositoryIds.map((id) => (
                      <span key={id} className="text-[9px] font-mono text-muted">
                        {repoNames.get(id) ?? id}
                      </span>
                    ))}
                  </div>
                  <Link
                    to="/threads/$threadId"
                    params={{ threadId: run.id }}
                    className="mt-2 block text-sm font-medium hover:text-glow"
                  >
                    {jobTitle(run)}
                  </Link>
                  <RequestPanel prompt={run.prompt} compact className="mt-3" />
                  {run.finalResponse && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted">{run.finalResponse}</p>
                  )}
                </article>
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
            {j.proposedRepositoryIds?.length ? (
              <>
                <p className="mb-3 text-sm">
                  The planner needs write access to{" "}
                  {j.proposedRepositoryIds.map((id) => repoNames.get(id) ?? id).join(", ")}. Access
                  will not expand unless you approve.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => scopeDecision.mutate({ decision: "approve" })}
                    disabled={scopeDecision.isPending}
                    className="rounded-md bg-foreground px-4 py-2 text-[10px] font-mono uppercase text-void disabled:opacity-50"
                  >
                    Approve suggested scope
                  </button>
                  <button
                    onClick={() => scopeDecision.mutate({ decision: "reject" })}
                    disabled={scopeDecision.isPending}
                    className="rounded-md border border-edge px-4 py-2 text-[10px] font-mono uppercase disabled:opacity-50"
                  >
                    Keep Current Scope
                  </button>
                  <button
                    onClick={() => {
                      setFollowUpScope("manual");
                      setFollowUpRepositories(j.resolvedRepositoryIds ?? []);
                      document
                        .getElementById("continue-conversation")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="rounded-md border border-edge px-4 py-2 text-[10px] font-mono uppercase"
                  >
                    Choose repositories
                  </button>
                </div>
                {followUpScope === "manual" && (
                  <div className="mt-3 rounded-lg border border-edge bg-void/40 p-3">
                    <div className="mb-2 text-[10px] font-mono uppercase text-muted">
                      Manual repository scope
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {projectRepositories(
                        project.data ?? { id: "", name: "", repositories: [] },
                      ).map((repository) => (
                        <label
                          key={repository.id}
                          className="flex items-center gap-2 rounded border border-edge px-3 py-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={followUpRepositories.includes(repository.id)}
                            onChange={() =>
                              setFollowUpRepositories((ids) =>
                                ids.includes(repository.id)
                                  ? ids.filter((id) => id !== repository.id)
                                  : [...ids, repository.id],
                              )
                            }
                          />
                          {repository.name}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!followUpRepositories.length || scopeDecision.isPending}
                      onClick={() =>
                        scopeDecision.mutate({ decision: "choose", ids: followUpRepositories })
                      }
                      className="mt-3 rounded-md bg-foreground px-4 py-2 text-[10px] font-mono uppercase text-void disabled:bg-edge"
                    >
                      Run with chosen scope
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </section>
        )}
        {(cancel.isError || sendReply.isError || sendFollowUp.isError || scopeDecision.isError) && (
          <ErrorState
            error={cancel.error ?? sendReply.error ?? sendFollowUp.error ?? scopeDecision.error}
          />
        )}
        {streamError && active && (
          <div className="rounded-lg border border-alert/30 bg-alert-soft p-3 text-xs text-alert">
            {streamError}
          </div>
        )}
        {completed && finalResponse}
        {j.status === "done" && <ReviewChanges jobId={j.id} />}
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
                  {typeof result.scopeReason === "string" && (
                    <p className="mt-2 text-xs text-muted">
                      Included because: {result.scopeReason}
                    </p>
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
          <section
            id="continue-conversation"
            className="sticky bottom-3 rounded-xl border border-glow/40 bg-void/95 p-4 shadow-xl backdrop-blur lg:p-5"
          >
            <h2 className="mb-2 text-[10px] font-mono uppercase tracking-widest text-glow">
              Continue conversation
            </h2>
            <p className="mb-3 text-xs text-muted">
              Starts a linked run with the same {j.agent} agent. Choose whether to retain or correct
              repository scope.
            </p>
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
              {(["keep", "auto", "manual"] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => {
                    setFollowUpScope(mode);
                    if (mode === "manual" && followUpRepositories.length === 0)
                      setFollowUpRepositories(j.resolvedRepositoryIds ?? []);
                  }}
                  className={`rounded-md border px-3 py-2 text-left text-xs ${followUpScope === mode ? "border-glow bg-glow-soft" : "border-edge bg-surface"}`}
                >
                  {mode === "keep"
                    ? "Keep current"
                    : mode === "auto"
                      ? "Auto-select again"
                      : "Manual scope"}
                </button>
              ))}
            </div>
            {followUpScope === "manual" && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {projectRepositories(project.data ?? { id: "", name: "", repositories: [] }).map(
                  (repository) => (
                    <label
                      key={repository.id}
                      className="flex items-center gap-2 rounded-md border border-edge bg-surface px-3 py-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={followUpRepositories.includes(repository.id)}
                        onChange={() =>
                          setFollowUpRepositories((ids) =>
                            ids.includes(repository.id)
                              ? ids.filter((id) => id !== repository.id)
                              : [...ids, repository.id],
                          )
                        }
                      />
                      {repository.name}
                    </label>
                  ),
                )}
              </div>
            )}
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
                disabled={
                  !followUp.trim() ||
                  sendFollowUp.isPending ||
                  (followUpScope === "manual" && followUpRepositories.length === 0)
                }
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

const REQUEST_PREVIEW_LENGTH = 420;

function RequestPanel({
  prompt,
  compact = false,
  className = "",
}: {
  prompt: string;
  compact?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const request = prompt.trim();
  const isLong = request.length > REQUEST_PREVIEW_LENGTH || request.split("\n").length > 6;
  const visibleRequest =
    isLong && !expanded ? `${request.slice(0, REQUEST_PREVIEW_LENGTH).trimEnd()}…` : request;

  return (
    <div
      className={`${compact ? "rounded-md" : "rounded-lg"} border border-edge bg-void/60 p-3 lg:p-4 ${className}`}
    >
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted">
        Original request
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
        {visibleRequest || "No request text was recorded."}
      </p>
      {isLong && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 rounded-sm text-[10px] font-mono uppercase tracking-wider text-glow hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/60"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ReviewChanges({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submissionGuard = useRef(false);
  const changes = useQuery({
    queryKey: ["job-changes", jobId],
    queryFn: () => getJobChanges(jobId),
  });
  const deployments = useQuery({
    queryKey: ["job-deployments", jobId],
    queryFn: () => getJobDeployments(jobId),
    enabled: Boolean(changes.data?.promotion),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((deployment) =>
        ["queued", "deploying"].includes(deployment.status),
      )
        ? 2_000
        : false,
  });
  useEffect(() => {
    if (!changes.data || selected.length) return;
    setSelected(
      changes.data.promotion
        ? changes.data.promotion.repositories.map((repo) => repo.repositoryId)
        : changes.data.repositories
            .filter((repo) => repo.hasChanges)
            .map((repo) => repo.repositoryId),
    );
    if (changes.data.promotion) setMessage(changes.data.promotion.commitMessage);
  }, [changes.data, selected.length]);
  const promotion = useMutation({
    mutationFn: ({
      commitMessage,
      repositoryIds,
    }: {
      commitMessage: string;
      repositoryIds: string[];
    }) => promoteJob(jobId, commitMessage, repositoryIds),
    onSettled: async () => {
      try {
        await queryClient.invalidateQueries({ queryKey: ["job-changes", jobId] });
        await queryClient.invalidateQueries({ queryKey: ["job-deployments", jobId] });
      } finally {
        submissionGuard.current = false;
        setSubmitting(false);
        setConfirming(false);
      }
    },
  });
  const submitPromotion = () => {
    if (submissionGuard.current || submitting) return;
    const commitMessage = message.trim();
    if (!commitMessage || selected.length === 0) return;

    submissionGuard.current = true;
    setSubmitting(true);
    promotion.mutate({ commitMessage, repositoryIds: [...selected] });
  };
  if (changes.isPending)
    return (
      <section className="rounded-xl border border-glow/30 bg-glow-soft p-4 text-sm text-muted">
        Checking for reviewable changes…
      </section>
    );
  if (changes.isError) return <ErrorState error={changes.error} retry={() => changes.refetch()} />;
  const data = changes.data;
  const promoted = data.promotion?.status === "promoted";
  const failed = data.promotion?.repositories.filter((repo) => repo.status === "failed") ?? [];
  if (!open && data.hasChanges && !promoted)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border-2 border-glow/60 bg-glow-soft p-4 text-left shadow-glow transition hover:border-glow lg:p-5"
      >
        <span>
          <span className="block text-sm font-semibold">Review changes</span>
          <span className="mt-1 block text-xs text-muted">
            Inspect files and diffs before approving a Git push.
          </span>
        </span>
        <GitPullRequest className="size-5 text-glow" aria-hidden="true" />
      </button>
    );
  if (!data.hasChanges && !data.promotion)
    return (
      <section className="rounded-xl border border-edge bg-surface/50 p-4">
        <div className="text-sm font-medium">No changes to promote</div>
        <p className="mt-1 text-xs text-muted">This job did not modify any repository files.</p>
        <a
          href="#continue-conversation"
          className="mt-3 inline-block text-[10px] font-mono uppercase text-glow"
        >
          Retry with different scope
        </a>
      </section>
    );
  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-surface/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge p-4 lg:p-5">
        <div>
          <h2 className="text-sm font-semibold">Review changes</h2>
          <p className="mt-1 text-xs text-muted">
            Only selected repositories will be committed and pushed.
          </p>
        </div>
        {!promoted && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => setOpen((value) => !value)}
            className="text-[10px] font-mono uppercase text-muted disabled:opacity-50"
          >
            {open ? "Collapse" : "Open review"}
          </button>
        )}
      </div>
      {promoted && !submitting && (
        <div className="border-b border-glow/30 bg-glow-soft p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-glow">
            <CheckCircle2 className="size-4" /> Pushed to GitHub
          </div>
          <p className="mt-1 text-xs text-muted">
            Source changes were pushed. Eligible backend deployments run automatically; frontend
            deployment remains managed by Render.
          </p>
        </div>
      )}
      {deployments.data && deployments.data.length > 0 && (
        <DeploymentProgress deployments={deployments.data} />
      )}
      {failed.length > 0 && !submitting && (
        <div className="border-b border-alert/30 bg-alert-soft p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-alert">
            <TriangleAlert className="size-4" />{" "}
            {failed.some((r) => r.conflict) ? "Push conflict" : "Push failed"}
          </div>
          {failed.map((r) => (
            <p key={r.repositoryId} className="mt-1 text-xs text-muted">
              {r.error}
            </p>
          ))}
        </div>
      )}
      {(open || promoted || failed.length > 0) && (
        <div className="space-y-4 p-4 lg:p-5">
          {data.repositories
            .filter(
              (repo) =>
                repo.hasChanges ||
                data.promotion?.repositories.some((r) => r.repositoryId === repo.repositoryId),
            )
            .map((repo) => {
              const result = data.promotion?.repositories.find(
                (r) => r.repositoryId === repo.repositoryId,
              );
              const checked = selected.includes(repo.repositoryId);
              return (
                <article
                  key={repo.repositoryId}
                  className="rounded-lg border border-edge bg-void/50"
                >
                  <div className="flex items-start gap-3 p-3 lg:p-4">
                    {!promoted && (
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--glow)]"
                        checked={checked}
                        disabled={submitting || result?.status === "promoted"}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, repo.repositoryId]
                              : current.filter((id) => id !== repo.repositoryId),
                          )
                        }
                        aria-label={`Approve ${repo.repositoryName}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">{repo.repositoryName}</h3>
                        <span className="font-mono text-[10px] text-muted">
                          +{repo.additions} / −{repo.deletions}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] font-mono text-muted">
                        target: {repo.targetBranch} · base: {repo.baseCommitSha.slice(0, 12)}
                      </div>
                      {result && (
                        <div
                          className={`mt-2 text-[10px] font-mono uppercase ${result.status === "promoted" ? "text-glow" : result.conflict ? "text-alert" : "text-danger"}`}
                        >
                          {result.status === "promoted"
                            ? "Pushed to GitHub"
                            : result.conflict
                              ? "Conflict"
                              : result.status}
                          {result.commitSha ? ` · ${result.commitSha.slice(0, 12)}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-edge">
                    {repo.changedFiles.map((file) => (
                      <details key={file.path} className="border-b border-edge last:border-0">
                        <summary className="cursor-pointer break-all px-3 py-2 font-mono text-xs lg:px-4">
                          {file.path}{" "}
                          <span className="text-muted">
                            +{file.additions} −{file.deletions}
                          </span>
                        </summary>
                        <pre className="max-h-[32rem] overflow-auto border-t border-edge bg-black/30 p-3 text-[11px] leading-relaxed">
                          <code>{file.diff || "Binary file or metadata-only change"}</code>
                        </pre>
                        {file.truncated && (
                          <p className="border-t border-edge px-3 py-2 text-[10px] text-alert">
                            Diff truncated by server safety limit.
                          </p>
                        )}
                      </details>
                    ))}
                  </div>
                </article>
              );
            })}
          {!promoted && (
            <div className="space-y-3 rounded-lg border border-edge p-3 lg:p-4">
              <label
                htmlFor={`commit-${jobId}`}
                className="block text-[10px] font-mono uppercase tracking-widest text-muted"
              >
                Commit message
              </label>
              <textarea
                id={`commit-${jobId}`}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={submitting}
                maxLength={500}
                rows={3}
                placeholder="Describe the approved changes"
                className="w-full resize-y rounded-md border border-edge bg-void px-3 py-2 text-sm focus:border-glow focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                disabled={
                  (!data.hasChanges && failed.length === 0) ||
                  selected.length === 0 ||
                  !message.trim() ||
                  submitting
                }
                onClick={() => setConfirming(true)}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-glow px-4 text-sm font-semibold text-void disabled:bg-edge disabled:text-muted"
              >
                {submitting ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <GitCommitHorizontal className="size-4" aria-hidden="true" />
                )}
                {submitting
                  ? "Pushing…"
                  : failed.length
                    ? "Retry failed repositories"
                    : "Approve & Push"}
              </button>
              {promotion.isError && failed.length === 0 && !submitting && (
                <p role="alert" className="text-xs text-danger">
                  Push failed: {errorMessage(promotion.error)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {confirming && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`confirm-${jobId}`}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-edge bg-void p-5 shadow-2xl">
            <h3 id={`confirm-${jobId}`} className="text-lg font-semibold">
              Approve and push?
            </h3>
            <p className="mt-2 text-sm text-muted">
              This will commit the selected job changes and push them to {selected.length} target{" "}
              {selected.length === 1 ? "branch" : "branches"}. An approved backend push queues its
              exact commit for EC2 deployment; frontend pushes continue through Render.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirming(false)}
                className="rounded-md border border-edge px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitPromotion}
                className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-glow px-4 py-2 text-sm font-semibold text-void disabled:bg-edge disabled:text-muted"
              >
                {submitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
                {submitting ? "Pushing…" : "Approve & Push"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const deploymentLabels: Record<Deployment["status"], string> = {
  queued: "Deployment queued",
  deploying: "Deploying backend",
  succeeded: "Backend deployed",
  failed: "Deployment failed",
  rolled_back: "Deployment failed · rolled back",
};

function DeploymentProgress({ deployments }: { deployments: Deployment[] }) {
  return (
    <div className="border-b border-edge bg-void/40 p-4" aria-live="polite">
      {deployments.map((deployment) => {
        const active = deployment.status === "queued" || deployment.status === "deploying";
        const successful = deployment.status === "succeeded";
        return (
          <div key={deployment.id} className="flex items-start gap-2">
            {active ? (
              <LoaderCircle className="mt-0.5 size-4 animate-spin text-glow" aria-hidden="true" />
            ) : successful ? (
              <CheckCircle2 className="mt-0.5 size-4 text-glow" aria-hidden="true" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 text-alert" aria-hidden="true" />
            )}
            <div>
              <div
                className={`text-sm font-semibold ${successful || active ? "text-glow" : "text-alert"}`}
              >
                {deploymentLabels[deployment.status]}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase text-muted">
                {deployment.stage.replaceAll("_", " ")} · {deployment.commitSha.slice(0, 12)}
              </div>
              {deployment.errorCode && (
                <div className="mt-1 text-xs text-muted">
                  Error code: {deployment.errorCode.replaceAll("_", " ")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScopeList({
  title,
  ids,
  names,
  reasons,
  empty,
}: {
  title: string;
  ids: string[];
  names: Map<string, string>;
  reasons?: Job["scopeReasons"];
  empty: string;
}) {
  return (
    <div>
      <h2 className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted">{title}</h2>
      {ids.length ? (
        <ul className="space-y-2">
          {ids.map((id) => (
            <li key={id} className="rounded-lg border border-edge bg-void/50 p-3">
              <div className="text-xs font-medium">{names.get(id) ?? id}</div>
              {reasons?.find((reason) => reason.repositoryId === id)?.reason && (
                <p className="mt-1 text-[10px] leading-relaxed text-muted">
                  {reasons.find((reason) => reason.repositoryId === id)?.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">{empty}</p>
      )}
    </div>
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
