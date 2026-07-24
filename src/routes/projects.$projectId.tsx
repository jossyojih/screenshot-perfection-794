import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, GitBranch, Plus, Search, TriangleAlert } from "lucide-react";
import { AddRepositoryDialog } from "@/components/AddRepositoryDialog";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { groupJobsByThread } from "@/lib/threads";
import {
  errorMessage,
  formatTime,
  getCapabilities,
  getJobs,
  getProject,
  jobTitle,
  projectRepositories,
  updateProjectAgentDefaults,
  updateProjectPromotionPolicy,
  updateRepositoryPromotionPolicy,
  type Agent,
  type PromotionPolicy,
  type ReasoningLevel,
} from "@/lib/api";
export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({ meta: [{ title: "Project — Command Center" }] }),
  component: ProjectDetail,
});
function ProjectDetail() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const [threadSearch, setThreadSearch] = useState("");
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>("all");
  const [threadPage, setThreadPage] = useState(1);
  const [openSections, setOpenSections] = useState<string[]>(() => {
    const stored = sessionStorage.getItem(`project-${projectId}-sections`);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    sessionStorage.setItem(`project-${projectId}-sections`, JSON.stringify(openSections));
  }, [projectId, openSections]);
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: getCapabilities });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: getJobs, refetchInterval: 5000 });
  const policyUpdate = useMutation({
    mutationFn: (input: { repositoryId?: string; policy: PromotionPolicy | null }) =>
      input.repositoryId
        ? updateRepositoryPromotionPolicy(projectId, input.repositoryId, input.policy)
        : updateProjectPromotionPolicy(projectId, input.policy as PromotionPolicy),
    onSuccess: (updated) => queryClient.setQueryData(["project", projectId], updated),
  });
  const agentDefaultsUpdate = useMutation({
    mutationFn: (input: { agent: Agent; model?: string; reasoningLevel?: ReasoningLevel }) =>
      updateProjectAgentDefaults(projectId, input),
    onSuccess: (updated) => queryClient.setQueryData(["project", projectId], updated),
  });
  if (project.isPending)
    return (
      <AppShell title="Project">
        <Page>
          <LoadingState />
        </Page>
      </AppShell>
    );
  if (project.isError)
    return (
      <AppShell title="Project">
        <Page>
          <ErrorState error={project.error} retry={() => project.refetch()} />
        </Page>
      </AppShell>
    );
  const p = project.data;
  const repos = projectRepositories(p);
  const projectJobs = (jobs.data ?? []).filter((j) => j.projectId === p.id);
  const projectThreads = groupJobsByThread(projectJobs);
  const query = threadSearch.trim().toLocaleLowerCase();
  const filteredThreads = projectThreads.filter((thread) => {
    const matchesSearch =
      !query ||
      jobTitle(thread.initialRun).toLocaleLowerCase().includes(query) ||
      thread.agents.some((agent) => agent.toLocaleLowerCase().includes(query));
    return matchesSearch && matchesThreadFilter(thread.latestRun.status, threadFilter);
  });

  // Sort threads: Needs Input > Running/Queued > Failed > Recently completed
  const sortedThreads = [...filteredThreads].sort((a, b) => {
    const statusA = a.latestRun.status;
    const statusB = b.latestRun.status;
    const priorityA = getThreadSortPriority(statusA);
    const priorityB = getThreadSortPriority(statusB);
    if (priorityA !== priorityB) return priorityA - priorityB;
    // Within same priority, sort by recent activity
    const timeA = Date.parse(a.activityAt ?? "");
    const timeB = Date.parse(b.activityAt ?? "");
    return timeB - timeA;
  });

  const pageCount = Math.max(1, Math.ceil(sortedThreads.length / THREADS_PER_PAGE));
  const currentPage = Math.min(threadPage, pageCount);
  const visibleThreads = sortedThreads.slice(
    (currentPage - 1) * THREADS_PER_PAGE,
    currentPage * THREADS_PER_PAGE,
  );

  const reposById = new Map(repos.map((r) => [r.id, r]));
  const defaultPolicy = p.promotionPolicy ?? "review_required";
  return (
    <AppShell
      title={p.name}
      headerRight={
        <Link to="/projects" className="text-[10px] font-mono uppercase tracking-widest text-muted">
          ← Projects
        </Link>
      }
    >
      <Page>
        <div className="mb-6 rounded-xl border border-edge bg-surface p-4 lg:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[.2em] text-glow">
                <span className="size-1.5 rounded-full bg-glow" />
                Project
              </div>
              <h2 className="mt-2 text-xl font-semibold lg:text-2xl">{p.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>
                  {repos.length} {repos.length === 1 ? "repository" : "repositories"}
                </span>
                <span className="text-muted/40">·</span>
                <span>Default policy: {policyLabel(defaultPolicy)}</span>
              </div>
            </div>
            {repos.length > 0 ? (
              <Link
                to="/compose"
                search={{ projectId: p.id, threadId: undefined }}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-glow px-4 text-xs font-bold uppercase tracking-widest text-void"
              >
                <Plus className="size-4" /> New instruction
              </Link>
            ) : (
              <span className="flex h-10 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-edge px-4 text-xs font-bold uppercase tracking-widest text-muted">
                <Plus className="size-4" /> New instruction
              </span>
            )}
          </div>
        </div>
        {repos.length === 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-alert/40 bg-alert-soft p-5">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-alert" />
            <div>
              <p className="text-sm font-medium text-alert">Setup required</p>
              <p className="mt-1 text-xs text-muted">
                No repositories are connected. Add at least one repository to start dispatching
                tasks.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-6">
          <section>
            <div className="mb-3">
              <Heading
                title="Threads"
                meta={`${projectThreads.length} threads · ${projectJobs.length} runs`}
              />
            </div>
            {jobs.isPending ? (
              <LoadingState />
            ) : jobs.isError ? (
              <ErrorState error={jobs.error} retry={() => jobs.refetch()} />
            ) : projectJobs.length === 0 ? (
              <DataState title="No jobs yet. Send a task to start one." />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-xs">
                    <Search
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                    />
                    <Input
                      type="search"
                      aria-label="Search threads by title or agent"
                      placeholder="Search title or agent"
                      value={threadSearch}
                      onChange={(event) => {
                        setThreadSearch(event.target.value);
                        setThreadPage(1);
                      }}
                      className="pl-9"
                    />
                  </div>
                  <div
                    className="grid grid-cols-2 gap-2 sm:flex"
                    role="group"
                    aria-label="Filter threads by status"
                  >
                    {THREAD_FILTERS.map(({ value, label }) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={threadFilter === value ? "default" : "outline"}
                        aria-pressed={threadFilter === value}
                        onClick={() => {
                          setThreadFilter(value);
                          setThreadPage(1);
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                {sortedThreads.length === 0 ? (
                  <DataState title="No threads match your search and filter." />
                ) : (
                  <>
                    <div className="overflow-hidden rounded-xl border border-edge bg-surface">
                      {visibleThreads.map(({ key, initialRun, latestRun, runCount }) => {
                        const scopeRepos = latestRun.resolvedRepositoryIds
                          .map((id) => reposById.get(id)?.name)
                          .filter(Boolean);
                        return (
                          <Link
                            key={key}
                            to="/threads/$threadId"
                            params={{ threadId: latestRun.id }}
                            className="group block border-b border-edge p-4 last:border-0 hover:bg-glow-soft/50 lg:p-5"
                          >
                            <div className="flex justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                  {jobTitle(initialRun)}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-mono uppercase tracking-widest text-muted">
                                  <span>{latestRun.agent}</span>
                                  {latestRun.model && (
                                    <>
                                      <span className="text-muted/40">·</span>
                                      <span>{latestRun.model}</span>
                                    </>
                                  )}
                                  {scopeRepos.length > 0 && (
                                    <>
                                      <span className="text-muted/40">·</span>
                                      <span className="truncate">
                                        {scopeRepos.length === 1
                                          ? scopeRepos[0]
                                          : `${scopeRepos.length} repos`}
                                      </span>
                                    </>
                                  )}
                                  <span className="text-muted/40">·</span>
                                  <span>
                                    {runCount} {runCount === 1 ? "run" : "runs"}
                                  </span>
                                  <span className="text-muted/40">·</span>
                                  <span>
                                    {formatTime(latestRun.updatedAt ?? latestRun.createdAt)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <StatusDot status={latestRun.status} />
                                <StatusPill status={latestRun.status} />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    <nav
                      className="flex items-center justify-between gap-3"
                      aria-label="Thread list pagination"
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={currentPage === 1}
                        onClick={() => setThreadPage((page) => Math.max(1, page - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-[10px] font-mono text-muted" aria-live="polite">
                        Page {currentPage} of {pageCount}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={currentPage === pageCount}
                        onClick={() => setThreadPage((page) => Math.min(pageCount, page + 1))}
                      >
                        Next
                      </Button>
                    </nav>
                  </>
                )}
              </div>
            )}
          </section>

          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-4"
          >
            <AccordionItem value="details" className="rounded-xl border border-edge bg-surface">
              <AccordionTrigger className="px-4 lg:px-5">
                <div className="flex w-full items-center justify-between pr-3">
                  <Heading title="Project Details" meta={p.description ? "Configured" : ""} />
                  <EditProjectDialog project={p} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 lg:px-5">
                {p.description && (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-muted">Description</label>
                    <p className="mt-1 text-sm">{p.description}</p>
                  </div>
                )}
                <div className="text-sm text-muted">
                  {repos.length > 0 ? (
                    <p>
                      This project coordinates {repos.length}{" "}
                      {repos.length === 1 ? "repository" : "repositories"}.
                    </p>
                  ) : (
                    <p>No repositories connected yet.</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              value="repositories"
              className="rounded-xl border border-edge bg-surface"
            >
              <AccordionTrigger className="px-4 lg:px-5">
                <div className="flex w-full items-center justify-between pr-3">
                  <Heading title="Repositories" meta={`${repos.length} connected`} />
                  <AddRepositoryDialog projectId={p.id} />
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 lg:px-5">
                {repos.length === 0 ? (
                  <DataState title="No repositories are connected to this project." />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {repos.map((r) => (
                      <div key={r.id} className="rounded-xl border border-edge bg-void p-4">
                        <span className="flex size-9 items-center justify-center rounded-lg border border-glow/25 bg-glow-soft text-glow">
                          <GitBranch className="size-4" />
                        </span>
                        <div className="mt-4 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{r.name}</div>
                            <div className="mt-1 text-[9px] font-mono text-muted">
                              {r.defaultBranch ?? "default branch"}
                              {r.status ? ` · ${r.status}` : ""}
                            </div>
                          </div>
                          {r.url && (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex size-7 shrink-0 items-center justify-center rounded-md border border-edge text-muted hover:border-glow hover:bg-glow-soft hover:text-glow"
                              aria-label={`Open ${r.name} repository`}
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="settings" className="rounded-xl border border-edge bg-surface">
              <AccordionTrigger className="px-4 lg:px-5">
                <Heading title="Project Settings" meta="Backend enforced" />
              </AccordionTrigger>
              <AccordionContent className="px-4 lg:px-5">
                <div className="mb-6">
                  <label className="block text-xs font-medium" htmlFor="project-promotion-policy">
                    Default promotion policy
                  </label>
                  <select
                    id="project-promotion-policy"
                    value={p.promotionPolicy ?? "review_required"}
                    disabled={policyUpdate.isPending}
                    onChange={(event) =>
                      policyUpdate.mutate({ policy: event.target.value as PromotionPolicy })
                    }
                    className="mt-2 min-h-11 w-full rounded-md border border-edge bg-void px-3 text-sm md:max-w-md"
                  >
                    <PolicyOptions />
                  </select>
                </div>
                {capabilities.data && (
                  <div>
                    <h3 className="mb-3 text-xs font-medium">Agent and Model Defaults</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-muted">
                          Default Agent
                        </label>
                        <select
                          value={p.defaultAgent ?? ""}
                          disabled={agentDefaultsUpdate.isPending}
                          onChange={(event) => {
                            const agent = event.target.value as Agent;
                            const capability = capabilities.data.agents.find((a) => a.id === agent);
                            if (capability) {
                              agentDefaultsUpdate.mutate({
                                agent,
                                model: capability.defaults.model,
                                reasoningLevel: capability.defaults.reasoningLevel,
                              });
                            }
                          }}
                          className="mt-2 min-h-11 w-full rounded-md border border-edge bg-void px-3 text-sm font-mono md:max-w-md"
                        >
                          <option value="">
                            System default ({capabilities.data.defaults.agent})
                          </option>
                          {capabilities.data.agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.id}
                            </option>
                          ))}
                        </select>
                      </div>
                      {p.defaultAgent &&
                        capabilities.data.agents.find((a) => a.id === p.defaultAgent) && (
                          <>
                            {capabilities.data.agents.find((a) => a.id === p.defaultAgent)!.models
                              .length > 1 && (
                              <div>
                                <label className="block text-[10px] font-mono uppercase tracking-wider text-muted">
                                  Default Model
                                </label>
                                <select
                                  value={p.defaultModel ?? ""}
                                  disabled={agentDefaultsUpdate.isPending}
                                  onChange={(event) =>
                                    agentDefaultsUpdate.mutate({
                                      agent: p.defaultAgent!,
                                      model: event.target.value,
                                      reasoningLevel: p.defaultReasoningLevel,
                                    })
                                  }
                                  className="mt-2 min-h-11 w-full rounded-md border border-edge bg-void px-3 text-sm font-mono md:max-w-md"
                                >
                                  {capabilities.data.agents
                                    .find((a) => a.id === p.defaultAgent)!
                                    .models.map((m) => (
                                      <option key={m} value={m}>
                                        {m}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}
                            {p.defaultAgent === "codex" &&
                              capabilities.data.agents.find((a) => a.id === "codex")!
                                .reasoningLevels.length > 0 && (
                                <div>
                                  <label className="block text-[10px] font-mono uppercase tracking-wider text-muted">
                                    Default Reasoning Level
                                  </label>
                                  <select
                                    value={p.defaultReasoningLevel ?? ""}
                                    disabled={agentDefaultsUpdate.isPending}
                                    onChange={(event) =>
                                      agentDefaultsUpdate.mutate({
                                        agent: p.defaultAgent!,
                                        model: p.defaultModel,
                                        reasoningLevel: event.target.value as ReasoningLevel,
                                      })
                                    }
                                    className="mt-2 min-h-11 w-full rounded-md border border-edge bg-void px-3 text-sm font-mono md:max-w-md"
                                  >
                                    {capabilities.data.agents
                                      .find((a) => a.id === "codex")!
                                      .reasoningLevels.map((r) => (
                                        <option key={r} value={r}>
                                          {r}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )}
                          </>
                        )}
                    </div>
                    {agentDefaultsUpdate.isError && (
                      <p role="alert" className="mt-3 text-xs text-danger">
                        Could not save agent defaults: {errorMessage(agentDefaultsUpdate.error)}
                      </p>
                    )}
                    {agentDefaultsUpdate.isPending && (
                      <p aria-live="polite" className="mt-3 text-xs text-muted">
                        Saving agent defaults…
                      </p>
                    )}
                  </div>
                )}
                {(p.promotionPolicy === "auto_push" ||
                  repos.some((repo) => repo.promotionPolicyOverride === "auto_push")) && (
                  <div className="mt-3 flex gap-2 rounded-lg border border-alert/40 bg-alert-soft p-3 text-xs text-alert">
                    <TriangleAlert className="size-4 shrink-0" />
                    <span>
                      <strong>Auto-push is security-sensitive.</strong> Successfully validated agent
                      changes are committed and pushed without human review. Failed, cancelled,
                      conflicting, or unvalidated runs are never pushed.
                    </span>
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="grid gap-2 rounded-lg border border-edge p-3 md:grid-cols-[1fr_16rem] md:items-center"
                    >
                      <div>
                        <div className="text-sm font-medium">{repo.name}</div>
                        <div className="mt-1 text-[10px] font-mono uppercase text-muted">
                          Effective:{" "}
                          {policyLabel(
                            repo.effectivePromotionPolicy ?? p.promotionPolicy ?? "review_required",
                          )}
                        </div>
                      </div>
                      <select
                        aria-label={`${repo.name} promotion policy override`}
                        value={repo.promotionPolicyOverride ?? "inherit"}
                        disabled={policyUpdate.isPending}
                        onChange={(event) =>
                          policyUpdate.mutate({
                            repositoryId: repo.id,
                            policy:
                              event.target.value === "inherit"
                                ? null
                                : (event.target.value as PromotionPolicy),
                          })
                        }
                        className="min-h-11 rounded-md border border-edge bg-void px-3 text-sm"
                      >
                        <option value="inherit">Inherit project default</option>
                        <PolicyOptions />
                      </select>
                    </div>
                  ))}
                </div>
                {policyUpdate.isError && (
                  <p role="alert" className="mt-3 text-xs text-danger">
                    Could not save policy: {errorMessage(policyUpdate.error)}
                  </p>
                )}
                {policyUpdate.isPending && (
                  <p aria-live="polite" className="mt-3 text-xs text-muted">
                    Saving policy…
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </Page>
    </AppShell>
  );
}
const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">{children}</div>
);
const Heading = ({ title, meta }: { title: string; meta?: string }) => (
  <div className="flex w-full justify-between">
    <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted">{title}</h3>
    {meta && <span className="text-[10px] font-mono text-muted">{meta}</span>}
  </div>
);

type ThreadFilter = "all" | "active" | "needs_input" | "completed";

const THREADS_PER_PAGE = 8;
const THREAD_FILTERS: { value: ThreadFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "needs_input", label: "Needs Input" },
  { value: "completed", label: "Completed" },
];

function matchesThreadFilter(status: import("@/lib/api").JobStatus, filter: ThreadFilter) {
  if (filter === "all") return true;
  if (filter === "active") return status === "queued" || status === "running";
  if (filter === "needs_input") return status === "needs_input";
  return status === "done" || status === "failed" || status === "cancelled";
}

function getThreadSortPriority(status: import("@/lib/api").JobStatus): number {
  // Lower number = higher priority
  if (status === "needs_input") return 0;
  if (status === "running" || status === "queued") return 1;
  if (status === "failed") return 2;
  return 3; // done, cancelled
}
const policyLabel = (policy: PromotionPolicy) =>
  ({ review_required: "Review & Push", auto_push: "Auto-push", read_only: "Read-only" })[policy];
const PolicyOptions = () => (
  <>
    <option value="review_required">Review & Push</option>
    <option value="auto_push">Auto-push</option>
    <option value="read_only">Read-only</option>
  </>
);
