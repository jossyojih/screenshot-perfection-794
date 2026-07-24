import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileImage,
  GitCommitHorizontal,
  LoaderCircle,
  MoreHorizontal,
  SendHorizontal,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArchiveThreadButton } from "@/components/ArchiveThreadButton";
import { AttachmentUpload } from "@/components/AttachmentUpload";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import {
  cancelJob,
  decideJobScope,
  continueJob,
  errorMessage,
  formatTime,
  getCapabilities,
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
  type ReasoningLevel,
  authenticatedFetch,
  type AttachmentMetadata,
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

const FOLLOW_UP_MAX_HEIGHT = 152;

function resizeFollowUpInput(input: HTMLTextAreaElement | null) {
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, FOLLOW_UP_MAX_HEIGHT)}px`;
  input.style.overflowY = input.scrollHeight > FOLLOW_UP_MAX_HEIGHT ? "auto" : "hidden";
}

function ThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: getCapabilities });
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
  const [followUpModel, setFollowUpModel] = useState<string | undefined>(undefined);
  const [followUpReasoning, setFollowUpReasoning] = useState<ReasoningLevel | undefined>(undefined);
  const [followUpSettingsOpen, setFollowUpSettingsOpen] = useState(false);
  const [threadDetailsOpen, setThreadDetailsOpen] = useState(false);
  const [earlierRunsOpen, setEarlierRunsOpen] = useState(false);
  const [expandedEarlierRun, setExpandedEarlierRun] = useState<string>();
  const [followUpAttachments, setFollowUpAttachments] = useState<AttachmentMetadata[]>([]);
  const [followUpRequestId, setFollowUpRequestId] = useState(() => crypto.randomUUID());
  const followUpSubmitting = useRef(false);
  const scopeDecisionSubmitting = useRef(false);
  const followUpInputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLElement>(null);
  const [composerHeight, setComposerHeight] = useState(72);
  useEffect(() => resizeFollowUpInput(followUpInputRef.current), [followUp]);
  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const updateHeight = () => setComposerHeight(composer.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(composer);
    return () => observer.disconnect();
  }, [threadId, job.data?.status]);
  useEffect(() => {
    const status = job.data?.status;
    if (status === "queued" || status === "running") setActivityExpanded(true);
    if (status === "done" || status === "failed" || status === "cancelled")
      setActivityExpanded(false);
  }, [job.data?.status]);
  useEffect(() => {
    setThreadDetailsOpen(false);
    setEarlierRunsOpen(false);
    setExpandedEarlierRun(undefined);
  }, [threadId]);
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
    onSettled: () => {
      scopeDecisionSubmitting.current = false;
    },
  });
  const changes = useQuery({
    queryKey: ["job-changes", threadId],
    queryFn: () => getJobChanges(threadId),
    enabled: job.data?.status === "done",
  });
  const deployments = useQuery({
    queryKey: ["job-deployments", threadId],
    queryFn: () => getJobDeployments(threadId),
    enabled: Boolean(changes.data?.promotion),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((deployment) =>
        ["queued", "deploying"].includes(deployment.status),
      )
        ? 2_000
        : false,
  });
  const submitScopeDecision = (decision: "approve" | "reject" | "choose", ids?: string[]) => {
    if (scopeDecisionSubmitting.current || scopeDecision.isPending) return;
    scopeDecisionSubmitting.current = true;
    scopeDecision.mutate({ decision, ids });
  };
  const sendFollowUp = useMutation({
    mutationFn: (input: {
      prompt: string;
      requestId: string;
      scope: "keep" | "auto" | "manual";
      repositories: string[];
      model?: string;
      reasoningLevel?: ReasoningLevel;
      attachments?: AttachmentMetadata[];
    }) =>
      continueJob(
        threadId,
        input.prompt,
        input.requestId,
        input.scope === "keep"
          ? undefined
          : {
              scopeMode: input.scope,
              requestedRepositoryIds: input.scope === "manual" ? input.repositories : undefined,
            },
        input.model || input.reasoningLevel
          ? { model: input.model, reasoningLevel: input.reasoningLevel }
          : undefined,
        input.attachments,
      ),
    onSuccess: (created) => {
      setFollowUp("");
      setFollowUpRequestId(crypto.randomUUID());
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void navigate({ to: "/threads/$threadId", params: { threadId: created.id } });
    },
    onSettled: () => {
      followUpSubmitting.current = false;
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
  const conversationTitle = jobTitle(conversation.data?.[0] ?? j);
  const currentRunTitle = jobTitle(j);
  const normalizedPrompt = j.prompt
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  const showOriginalRequest = normalizedPrompt.toLowerCase() !== currentRunTitle.toLowerCase();
  const canContinue =
    ["done", "failed", "cancelled"].includes(j.status) &&
    (!conversation.data || conversation.data.at(-1)?.id === j.id);
  const selectedScopeSummary =
    followUpScope === "keep"
      ? `Current scope · ${(j.resolvedRepositoryIds ?? j.selectedRepositoryIds).length} repositor${(j.resolvedRepositoryIds ?? j.selectedRepositoryIds).length === 1 ? "y" : "ies"}`
      : followUpScope === "auto"
        ? "Auto-select repositories"
        : followUpRepositories.length
          ? followUpRepositories.map((id) => repoNames.get(id) ?? id).join(", ")
          : "No repositories selected";
  const agentCapability = capabilities.data?.agents.find((a) => a.id === j.agent);
  const submitFollowUp = () => {
    const prompt = followUp.trim();
    if (
      !prompt ||
      followUpSubmitting.current ||
      sendFollowUp.isPending ||
      (followUpScope === "manual" && followUpRepositories.length === 0)
    )
      return;
    followUpSubmitting.current = true;
    sendFollowUp.mutate({
      prompt,
      requestId: followUpRequestId,
      scope: followUpScope,
      repositories: [...followUpRepositories],
      model: followUpModel,
      reasoningLevel: followUpReasoning,
      attachments: followUpAttachments.length ? followUpAttachments : undefined,
    });
  };
  const activityId = `job-activity-${j.id}`;
  const hasThreadDetails =
    earlierRuns.length > 0 ||
    j.status === "done" ||
    events.length > 0 ||
    Boolean(j.usage) ||
    Boolean(j.threadRepositoryPermissions?.length);
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
  const getReviewStatus = () => {
    if (!changes.data) return null;
    const reviewableRepositories = changes.data.repositories.filter(
      (repo) => repo.hasChanges && repo.effectivePromotionPolicy === "review_required",
    );
    const promoted =
      Boolean(changes.data.promotion?.repositories.length) &&
      changes.data.promotion!.repositories.every((result) => result.status === "promoted");
    const failed =
      changes.data.promotion?.repositories.filter((repo) => repo.status === "failed") ?? [];
    const deploying = (deployments.data ?? []).some((d) =>
      ["queued", "deploying"].includes(d.status),
    );
    const deployFailed = (deployments.data ?? []).some((d) =>
      ["failed", "rolled_back"].includes(d.status),
    );
    const deploySucceeded =
      (deployments.data ?? []).every((d) => d.status === "succeeded") &&
      (deployments.data?.length ?? 0) > 0;

    if (!changes.data.hasChanges && !changes.data.promotion)
      return { label: "No changes", needsAction: false };
    if (failed.length > 0) return { label: "Push failed", needsAction: true };
    if (reviewableRepositories.length > 0 && !promoted)
      return { label: "Review changes", needsAction: true };
    if (changes.isPending) return { label: "Checking…", needsAction: false };
    if (deploying) return { label: "Deploying", needsAction: false };
    if (deployFailed) return { label: "Deployment failed", needsAction: false };
    if (deploySucceeded) return { label: "Deployed", needsAction: false };
    if (promoted) return { label: "Pushed", needsAction: false };
    return { label: "Review changes", needsAction: false };
  };
  const reviewStatus = j.status === "done" ? getReviewStatus() : null;
  const finalResponse = (j.finalResponse || j.status === "done") && (
    <section className="mr-auto w-[96%] rounded-lg border border-edge bg-surface p-2 sm:w-[92%] sm:p-4">
      <h2 className="mb-1.5 text-[9px] font-mono uppercase tracking-widest text-glow sm:mb-2 sm:text-[10px]">
        Final response
      </h2>
      <div className="whitespace-pre-wrap text-xs leading-relaxed sm:text-sm">
        {j.finalResponse ?? "Job completed without a final response."}
      </div>
    </section>
  );
  return (
    <AppShell
      title={conversationTitle}
      bottomBar={canContinue ? false : undefined}
      status={j.status}
      headerRight={
        <div className="flex items-center gap-2">
          {reviewStatus && (
            <button
              type="button"
              onClick={() => {
                setThreadDetailsOpen(true);
                setTimeout(() => {
                  document
                    .querySelector('[aria-label="Review changes section"]')
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }}
              className={`relative flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-mono uppercase tracking-wide transition-colors ${
                reviewStatus.needsAction
                  ? "border-glow/60 bg-glow-soft text-glow hover:border-glow"
                  : "border-edge bg-void/40 text-muted hover:text-foreground"
              }`}
              title="Jump to review changes section"
              aria-label="Jump to review changes section"
            >
              {reviewStatus.needsAction && (
                <span className="absolute -right-1 -top-1 size-2 animate-pulse rounded-full bg-glow" />
              )}
              <GitCommitHorizontal className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{reviewStatus.label}</span>
            </button>
          )}
          <ArchiveThreadButton
            threadId={j.id}
            active={active}
            onArchived={() => void navigate({ to: "/archived" })}
          />
          <button
            type="button"
            onClick={goBack}
            className="text-[10px] font-mono uppercase tracking-widest text-muted"
          >
            ← Back
          </button>
        </div>
      }
    >
      <Page bottomClearance={canContinue ? composerHeight : 0}>
        <section className="ml-auto w-[96%] rounded-lg border border-edge bg-surface/50 p-2 sm:w-[92%] sm:p-3 lg:p-4">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <StatusDot status={j.status} />
            <StatusPill status={j.status} />
            <span className="text-[9px] font-mono text-muted sm:text-[10px]">
              · {j.agent} · {j.model}
              {j.reasoningLevel && ` · ${j.reasoningLevel}`}
            </span>
            <span className="rounded border border-glow/30 bg-glow-soft px-1.5 py-0.5 text-[8px] font-mono uppercase text-glow sm:px-2 sm:py-1 sm:text-[9px]">
              {j.scopeMode ?? "manual"} scope
            </span>
            <span className="ml-auto text-[8px] font-mono text-muted sm:text-[9px]">
              updated {formatTime(j.updatedAt ?? j.createdAt)}
            </span>
          </div>
          <div className="mt-1.5 flex items-start gap-2 sm:mt-2 sm:gap-3">
            <h1 className="min-w-0 flex-1 text-sm font-semibold leading-tight sm:text-base lg:text-xl">
              {currentRunTitle}
            </h1>
            {hasThreadDetails && (
              <button
                type="button"
                aria-label={threadDetailsOpen ? "Hide thread details" : "Show thread details"}
                title={threadDetailsOpen ? "Hide thread details" : "Thread details"}
                aria-expanded={threadDetailsOpen}
                onClick={() => setThreadDetailsOpen((open) => !open)}
                className={`flex h-7 shrink-0 items-center justify-center gap-1 rounded-md border px-1.5 text-[9px] font-mono uppercase tracking-wide transition-colors sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-[10px] ${threadDetailsOpen ? "border-glow bg-glow-soft text-glow" : "border-edge bg-void/40 text-muted hover:text-foreground"}`}
              >
                <MoreHorizontal className="size-3.5 sm:size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Details</span>
                <ChevronDown
                  className={`size-2.5 transition-transform sm:size-3 ${threadDetailsOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
          {showOriginalRequest && (
            <RequestPanel prompt={j.prompt} compact className="mt-2 sm:mt-3" />
          )}
        </section>
        {finalResponse}
        {threadDetailsOpen && Boolean(j.threadRepositoryPermissions?.length) && (
          <section className="-order-1 rounded-xl border border-edge bg-surface/40 p-4 lg:p-6">
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted">
              Conversation repository scope
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {j.threadRepositoryPermissions?.map((permission) => (
                <div
                  key={permission.repositoryId}
                  className="rounded-md border border-edge bg-void/40 px-3 py-2 text-xs"
                >
                  <span className="font-medium">
                    {repoNames.get(permission.repositoryId) ?? permission.repositoryId}
                  </span>
                  <span className="text-muted">
                    {" — "}
                    {permission.decision === "rejected"
                      ? "not authorized for this conversation"
                      : permission.inherited
                        ? "approved earlier in this conversation"
                        : "approved for this conversation"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
        {threadDetailsOpen && earlierRuns.length > 0 && (
          <section className="-order-1 rounded-xl border border-edge bg-surface/40 p-4 lg:p-6">
            <button
              type="button"
              aria-expanded={earlierRunsOpen}
              aria-controls="earlier-conversation-runs"
              onClick={() => {
                setEarlierRunsOpen((open) => !open);
                if (earlierRunsOpen) setExpandedEarlierRun(undefined);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/60"
            >
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted">
                Earlier conversation runs
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-edge bg-void/50 px-2 py-1 text-[9px] font-mono text-muted">
                  {earlierRuns.length} {earlierRuns.length === 1 ? "run" : "runs"}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 text-muted transition-transform ${earlierRunsOpen ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            {earlierRunsOpen && (
              <div
                id="earlier-conversation-runs"
                className="mt-4 space-y-3 border-t border-edge pt-4"
              >
                {earlierRuns.map((run) => (
                  <article key={run.id} className="rounded-lg border border-edge bg-void/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={run.status} />
                      <span className="text-[10px] font-mono text-muted">
                        {run.agent} · {run.model}
                        {run.reasoningLevel && ` · ${run.reasoningLevel}`}
                      </span>
                      {run.selectedRepositoryIds.map((id) => (
                        <span key={id} className="text-[9px] font-mono text-muted">
                          {repoNames.get(id) ?? id}
                        </span>
                      ))}
                    </div>
                    <Link
                      to="/threads/$threadId"
                      params={{ threadId: run.id }}
                      className="mt-2 block break-words text-sm font-medium hover:text-glow"
                    >
                      {jobTitle(run)}
                    </Link>
                    <button
                      type="button"
                      aria-expanded={expandedEarlierRun === run.id}
                      aria-controls={`earlier-run-${run.id}`}
                      onClick={() =>
                        setExpandedEarlierRun((current) =>
                          current === run.id ? undefined : run.id,
                        )
                      }
                      className="mt-3 flex w-full items-center justify-between gap-2 rounded-md border border-edge px-3 py-2 text-[10px] font-mono uppercase text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/60 sm:w-auto"
                    >
                      {expandedEarlierRun === run.id ? "Hide details" : "Show details"}
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 transition-transform ${expandedEarlierRun === run.id ? "rotate-180" : ""}`}
                      />
                    </button>
                    {expandedEarlierRun === run.id && (
                      <div id={`earlier-run-${run.id}`} className="mt-3 border-t border-edge pt-3">
                        <RequestPanel
                          prompt={run.prompt}
                          compact
                          className="ml-auto w-[96%] sm:w-[92%]"
                        />
                        {run.finalResponse && (
                          <div className="mr-auto mt-3 w-[96%] rounded-md border border-edge bg-surface/60 p-3 sm:w-[92%]">
                            <div className="text-[9px] font-mono uppercase tracking-widest text-muted">
                              Final response
                            </div>
                            <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">
                              {run.finalResponse}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {(j.status === "queued" || j.status === "running") && (
          <section className="rounded-lg border border-glow/30 bg-glow-soft p-2 sm:p-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-widest text-glow sm:text-[10px]">
                  Agent is working
                </div>
                <p className="mt-0.5 text-[11px] text-muted sm:mt-1 sm:text-xs">
                  Live events will appear below.
                </p>
              </div>
              <button
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="rounded-md border border-danger/50 px-2 py-1.5 text-[9px] font-mono uppercase text-danger disabled:opacity-50 sm:px-3 sm:py-2 sm:text-[10px]"
              >
                {cancel.isPending ? "Cancelling…" : "Cancel job"}
              </button>
            </div>
          </section>
        )}
        {j.status === "needs_input" && (
          <section className="rounded-lg border border-alert/40 bg-alert-soft p-2 sm:p-4">
            <div className="mb-1.5 text-[9px] font-mono uppercase tracking-widest text-alert sm:mb-2 sm:text-[10px]">
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
                    onClick={() => submitScopeDecision("approve")}
                    disabled={scopeDecision.isPending}
                    className="rounded-md bg-foreground px-4 py-2 text-[10px] font-mono uppercase text-void disabled:opacity-50"
                  >
                    {scopeDecision.isPending ? "Approving…" : "Approve suggested scope"}
                  </button>
                  <button
                    onClick={() => submitScopeDecision("reject")}
                    disabled={scopeDecision.isPending}
                    className="rounded-md border border-edge px-4 py-2 text-[10px] font-mono uppercase disabled:opacity-50"
                  >
                    {scopeDecision.isPending ? "Saving…" : "Keep Current Scope"}
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
        {threadDetailsOpen && j.status === "done" && (
          <div aria-label="Review changes section">
            <ReviewChanges jobId={j.id} />
          </div>
        )}
        {(threadDetailsOpen || active) && (
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
        {threadDetailsOpen && j.usage && (
          <details className="group rounded-xl border border-edge bg-surface/60 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/60 [&::-webkit-details-marker]:hidden">
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted">
                Usage
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-edge bg-void/50 px-2 py-1 text-[9px] font-mono text-muted">
                  {Object.keys(j.usage).length} metrics
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-4 w-4 text-muted transition-transform group-open:rotate-180"
                />
              </span>
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-edge pt-4 sm:grid-cols-4">
              {Object.entries(j.usage).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-edge bg-void/60 p-3">
                  <div className="text-[9px] font-mono uppercase text-muted">
                    {key.replace(/([A-Z])/g, " $1")}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{String(value)}</div>
                </div>
              ))}
            </div>
          </details>
        )}
        {canContinue && (
          <section
            ref={composerRef}
            id="continue-conversation"
            className="fixed inset-x-0 bottom-0 z-40 w-full min-w-0 overflow-hidden border-t border-glow/40 bg-void lg:left-64"
          >
            <div className="mx-auto max-w-[1100px]">
              <div
                id="follow-up-settings"
                aria-hidden={!followUpSettingsOpen}
                className={`absolute inset-x-0 bottom-full left-1/2 max-h-[65vh] w-full max-w-[1100px] min-w-0 -translate-x-1/2 overflow-y-auto border-y border-edge bg-void p-4 shadow-2xl transition-all duration-200 ease-out lg:px-8 ${followUpSettingsOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
              >
                <div className="mx-auto max-w-[1100px]">
                  <div className="mb-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-glow">
                      Continue conversation
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Choose the repository scope and model for this follow-up.
                    </p>
                  </div>
                  <div className="mb-3 min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
                      Agent
                    </div>
                    <div className="mt-1 truncate text-xs" title={j.agent}>
                      {j.agent}
                    </div>
                    <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-muted">
                      Repository scope
                    </div>
                    <div className="mt-1 break-words text-xs text-foreground">
                      {selectedScopeSummary}
                    </div>
                  </div>
                  <div
                    className="grid gap-2 sm:grid-cols-3"
                    role="group"
                    aria-label="Repository scope"
                  >
                    {(["keep", "auto", "manual"] as const).map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        aria-pressed={followUpScope === mode}
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
                    <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                      {projectRepositories(
                        project.data ?? { id: "", name: "", repositories: [] },
                      ).map((repository) => (
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
                          <span className="min-w-0 break-words">{repository.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {agentCapability && agentCapability.models.length > 1 && (
                    <div className="mt-3">
                      <label className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-muted">
                        {j.agent === "claude" ? "Claude Model" : "Model"} (optional)
                      </label>
                      <select
                        value={followUpModel ?? ""}
                        onChange={(e) => setFollowUpModel(e.target.value || undefined)}
                        className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-xs font-mono"
                      >
                        <option value="">Keep current ({j.model})</option>
                        {agentCapability.models.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {agentCapability &&
                    agentCapability.reasoningLevels.length > 0 &&
                    j.agent === "codex" && (
                      <div className="mt-3">
                        <label className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-muted">
                          Reasoning Level (optional)
                        </label>
                        <select
                          value={followUpReasoning ?? ""}
                          onChange={(e) =>
                            setFollowUpReasoning(
                              (e.target.value || undefined) as ReasoningLevel | undefined,
                            )
                          }
                          className="w-full rounded-md border border-edge bg-surface px-3 py-2 text-xs font-mono"
                        >
                          <option value="">Keep current ({j.reasoningLevel})</option>
                          {agentCapability.reasoningLevels.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                </div>
              </div>
              <form
                className="mx-auto w-full max-w-[1100px] min-w-0"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitFollowUp();
                }}
              >
                <label htmlFor="follow-up-prompt" className="sr-only">
                  Follow-up instruction
                </label>
                <div className="relative w-full min-w-0 overflow-hidden">
                  <textarea
                    ref={followUpInputRef}
                    id="follow-up-prompt"
                    value={followUp}
                    onChange={(event) => {
                      setFollowUp(event.target.value);
                      resizeFollowUpInput(event.currentTarget);
                    }}
                    rows={1}
                    placeholder="Ask a follow-up…"
                    className="block min-h-[72px] max-h-[152px] w-full min-w-0 resize-none overflow-y-hidden overflow-x-hidden rounded-none border-0 bg-void px-3 pb-12 pt-2 text-base leading-6 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-glow/60 sm:text-sm lg:rounded-t-md lg:border-x lg:border-t lg:border-edge"
                  />
                  <div className="absolute inset-x-2 bottom-1 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <AttachmentUpload
                        onAttachmentsChange={setFollowUpAttachments}
                        disabled={sendFollowUp.isPending}
                        compact
                      />
                      <button
                        type="button"
                        aria-label="Conversation options"
                        title={`${j.agent} · ${followUpModel ?? j.model} · ${selectedScopeSummary}`}
                        aria-expanded={followUpSettingsOpen}
                        aria-controls="follow-up-settings"
                        onClick={() => setFollowUpSettingsOpen((open) => !open)}
                        className={`flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 ${followUpSettingsOpen ? "border-glow bg-glow-soft text-glow" : "border-edge bg-surface text-muted"}`}
                      >
                        <SlidersHorizontal className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="submit"
                      title="Send follow-up"
                      aria-label="Send follow-up"
                      disabled={
                        !followUp.trim() ||
                        sendFollowUp.isPending ||
                        (followUpScope === "manual" && followUpRepositories.length === 0)
                      }
                      aria-busy={sendFollowUp.isPending || followUpSubmitting.current}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-foreground text-void transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-edge"
                    >
                      {sendFollowUp.isPending ? (
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <SendHorizontal className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
                <span className="sr-only" role="status" aria-live="polite">
                  {sendFollowUp.isPending ? "Sending follow-up instruction" : ""}
                </span>
              </form>
              {followUpAttachments.length > 0 && (
                <div className="mx-auto max-w-[1100px] min-w-0 border-t border-edge px-3 py-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {followUpAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="relative flex items-center gap-2 rounded-lg border border-edge bg-surface p-2"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded bg-void/40">
                          <FileImage className="size-4 text-muted" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">{attachment.filename}</div>
                          <div className="text-[10px] text-muted">
                            {(attachment.sizeBytes / 1024).toFixed(1)}KB
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFollowUpAttachments((current) =>
                              current.filter((a) => a.id !== attachment.id),
                            )
                          }
                          className="shrink-0 rounded p-1 hover:bg-surface/50"
                          disabled={sendFollowUp.isPending}
                          aria-label={`Remove ${attachment.filename}`}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
      className={`${compact ? "rounded-md" : "rounded-lg"} border border-edge bg-void/60 p-2 sm:p-3 lg:p-4 ${className}`}
    >
      <div className="text-[8px] font-mono uppercase tracking-widest text-muted sm:text-[9px]">
        Original request
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90 sm:mt-2 sm:text-sm">
        {visibleRequest || "No request text was recorded."}
      </p>
      {isLong && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 rounded-sm text-[9px] font-mono uppercase tracking-wider text-glow hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/60 sm:mt-3 sm:text-[10px]"
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
            .filter(
              (repo) => repo.hasChanges && repo.effectivePromotionPolicy === "review_required",
            )
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
      <section
        className="rounded-xl border border-glow/30 bg-glow-soft p-4 text-sm text-muted"
        aria-live="polite"
      >
        <div className="flex min-h-11 items-center gap-2">
          <LoaderCircle className="size-4 shrink-0 animate-spin text-glow" aria-hidden="true" />
          Checking for reviewable changes…
        </div>
      </section>
    );
  if (changes.isError) return <ErrorState error={changes.error} retry={() => changes.refetch()} />;
  const data = changes.data;
  const reviewableRepositories = data.repositories.filter(
    (repo) => repo.hasChanges && repo.effectivePromotionPolicy === "review_required",
  );
  const reviewable = reviewableRepositories.length > 0;
  const promoted =
    Boolean(data.promotion?.repositories.length) &&
    data.promotion!.repositories.every((result) => result.status === "promoted");
  const failed = data.promotion?.repositories.filter((repo) => repo.status === "failed") ?? [];
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded="false"
        className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-xl p-4 text-left transition lg:p-5 ${reviewable && !promoted ? "border-2 border-glow/60 bg-glow-soft shadow-glow hover:border-glow" : "border border-edge bg-surface/50 hover:bg-surface"}`}
      >
        <span>
          <span className="block text-sm font-semibold">Review changes</span>
          <span className="mt-1 block text-xs text-muted">
            {promoted
              ? "Changes were pushed to GitHub. Open for promotion and deployment details."
              : reviewable
                ? "Awaiting review. Inspect files and diffs before approving a Git push."
                : data.hasChanges
                  ? "Open promotion details."
                  : "No repository changes were produced."}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>
    );
  if (!data.hasChanges && !data.promotion)
    return (
      <section className="rounded-xl border border-edge bg-surface/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">No changes to promote</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-[10px] font-mono uppercase text-muted"
          >
            Collapse
            <ChevronDown className="size-4 rotate-180" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">This job did not modify any repository files.</p>
        <a
          href="#continue-conversation"
          className="mt-3 inline-block text-[10px] font-mono uppercase text-glow"
        >
          Retry with different scope
        </a>
      </section>
    );
  if (!reviewable && data.hasChanges)
    return (
      <section className="rounded-xl border border-edge bg-surface/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Promotion results</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-[10px] font-mono uppercase text-muted"
          >
            Collapse
            <ChevronDown className="size-4 rotate-180" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {data.repositories
            .filter((repo) => repo.hasChanges)
            .map((repo) => {
              const result = data.promotion?.repositories.find(
                (item) => item.repositoryId === repo.repositoryId,
              );
              const label =
                repo.effectivePromotionPolicy === "read_only"
                  ? "Read-only"
                  : result?.status === "promoted"
                    ? "Auto-pushed"
                    : result?.status === "failed"
                      ? "Auto-push failed"
                      : "Auto-push pending";
              return (
                <div
                  key={repo.repositoryId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-edge p-3"
                >
                  <span className="text-sm">{repo.repositoryName}</span>
                  <span
                    className={`text-[10px] font-mono uppercase ${label === "Auto-pushed" ? "text-glow" : label.includes("failed") ? "text-danger" : "text-muted"}`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
        </div>
      </section>
    );
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-edge bg-surface/60">
      <div className="flex flex-col items-stretch gap-3 border-b border-edge p-4 sm:flex-row sm:items-center sm:justify-between lg:p-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Review changes</h2>
          <p className="mt-1 text-xs text-muted">
            Only selected repositories will be committed and pushed.
          </p>
        </div>
        <button
          type="button"
          disabled={submitting}
          aria-expanded="true"
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center gap-2 self-start rounded-md px-2 text-[10px] font-mono uppercase text-muted disabled:opacity-50 sm:min-h-0 sm:self-auto sm:p-0"
        >
          Collapse
          <ChevronDown className="size-4 rotate-180" aria-hidden="true" />
        </button>
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
            <p key={r.repositoryId} className="mt-1 break-words text-xs text-muted">
              {r.error}
            </p>
          ))}
        </div>
      )}
      {(open || promoted || failed.length > 0) && (
        <div className="min-w-0 space-y-4 p-3 min-[380px]:p-4 lg:p-5">
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
              const additions = result?.status === "promoted" ? result.additions : repo.additions;
              const deletions = result?.status === "promoted" ? result.deletions : repo.deletions;
              const changedFiles =
                result?.status === "promoted" ? result.changedFiles : repo.changedFiles.length;
              return (
                <article
                  key={repo.repositoryId}
                  className="min-w-0 overflow-hidden rounded-lg border border-edge bg-void/50"
                >
                  <div className="flex min-w-0 items-start gap-3 p-3 lg:p-4">
                    {!promoted && repo.effectivePromotionPolicy === "review_required" && (
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 accent-[var(--glow)]"
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
                      <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                        <h3 className="break-words font-medium">{repo.repositoryName}</h3>
                        <span className="font-mono text-[10px] text-muted">
                          {changedFiles} {changedFiles === 1 ? "file" : "files"} · +{additions} / −
                          {deletions}
                        </span>
                      </div>
                      <div className="mt-1 break-all text-[10px] font-mono text-muted">
                        target: {repo.targetBranch} · base: {repo.baseCommitSha.slice(0, 12)}
                      </div>
                      <div
                        className={`mt-2 text-[10px] font-mono uppercase ${repo.effectivePromotionPolicy === "auto_push" ? (result?.status === "failed" ? "text-danger" : "text-glow") : repo.effectivePromotionPolicy === "read_only" ? "text-muted" : "text-alert"}`}
                      >
                        {repo.effectivePromotionPolicy === "auto_push"
                          ? result?.status === "promoted"
                            ? "Auto-pushed"
                            : result?.status === "failed"
                              ? "Auto-push failed"
                              : "Auto-push pending"
                          : repo.effectivePromotionPolicy === "read_only"
                            ? "Read-only"
                            : result?.status === "failed"
                              ? "Push failed"
                              : "Awaiting review"}
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
                  <div className="min-w-0 border-t border-edge">
                    <div className="bg-surface/50 px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-muted lg:px-4">
                      Changed files
                    </div>
                    {repo.changedFiles.map((file) => (
                      <details key={file.path} className="min-w-0 border-t border-edge">
                        <summary className="min-h-11 cursor-pointer break-all px-3 py-3 font-mono text-xs lg:px-4">
                          {file.path}{" "}
                          <span className="text-muted">
                            +{file.additions} −{file.deletions}
                          </span>
                        </summary>
                        <pre className="max-h-[60vh] w-full max-w-full overscroll-contain overflow-auto border-t border-edge bg-black/30 p-3 text-[11px] leading-relaxed [contain:inline-size]">
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
          {!promoted && reviewable && (
            <div className="sticky bottom-3 z-20 space-y-3 rounded-lg border border-glow/40 bg-void/95 p-3 shadow-xl backdrop-blur lg:static lg:border-edge lg:bg-transparent lg:p-4 lg:shadow-none">
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
                className="min-h-20 w-full resize-y rounded-md border border-edge bg-void px-3 py-2 text-base focus:border-glow focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
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
                  <span className="break-words">Push failed: {errorMessage(promotion.error)}</span>
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
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-3 min-[380px]:p-4"
        >
          <div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-xl border border-edge bg-void p-4 shadow-2xl min-[380px]:p-5">
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
                className="min-h-11 rounded-md border border-edge px-4 py-2 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitPromotion}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-glow px-4 py-2 text-sm font-semibold text-void disabled:bg-edge disabled:text-muted"
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
    <div className="space-y-3 border-b border-edge bg-void/40 p-4" aria-live="polite">
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
            <div className="min-w-0">
              <div
                className={`text-sm font-semibold ${successful || active ? "text-glow" : "text-alert"}`}
              >
                {deploymentLabels[deployment.status]}
              </div>
              <div className="mt-1 break-all font-mono text-[10px] uppercase text-muted">
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
const Page = ({
  children,
  bottomClearance = 0,
}: {
  children: React.ReactNode;
  bottomClearance?: number;
}) => (
  <div
    className="mx-auto flex min-w-0 max-w-[1100px] flex-col gap-3 overflow-x-clip py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:gap-6 sm:py-5 lg:px-8 lg:py-8"
    style={bottomClearance ? { paddingBottom: bottomClearance } : undefined}
  >
    {children}
  </div>
);
