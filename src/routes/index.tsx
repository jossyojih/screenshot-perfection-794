import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  FolderGit2,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { ArchiveThreadButton } from "@/components/ArchiveThreadButton";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  formatTime,
  getJobs,
  getProjects,
  getRunnerHealth,
  jobTitle,
  projectRepositories,
  type Project,
} from "@/lib/api";
import {
  groupJobsByThread,
  isCompletedThread,
  isRunningThread,
  needsThreadAttention,
  type ConversationThread,
} from "@/lib/threads";

const SECTION_LIMIT = 5;
const PROJECT_LIMIT = 6;

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview — Command Center" }] }),
  component: OverviewPage,
});

function OverviewPage() {
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: getJobs, refetchInterval: 5000 });
  const healthQuery = useQuery({
    queryKey: ["runner-health"],
    queryFn: getRunnerHealth,
    refetchInterval: 15000,
    retry: 1,
  });

  if (projectsQuery.isPending || jobsQuery.isPending)
    return (
      <AppShell title="Overview">
        <Page>
          <LoadingState />
        </Page>
      </AppShell>
    );
  if (projectsQuery.isError || jobsQuery.isError)
    return (
      <AppShell title="Overview">
        <Page>
          <ErrorState
            error={projectsQuery.error ?? jobsQuery.error}
            retry={() => {
              projectsQuery.refetch();
              jobsQuery.refetch();
            }}
          />
        </Page>
      </AppShell>
    );

  const projects = projectsQuery.data;
  const jobs = jobsQuery.data;
  const threads = groupJobsByThread(jobs);
  const attention = threads.filter((thread) => needsThreadAttention(thread.latestRun.status));
  const running = threads.filter((thread) => isRunningThread(thread.latestRun.status));
  const completed = threads.filter((thread) => isCompletedThread(thread.latestRun.status));
  const completedToday = completed.filter((thread) => isToday(thread.activityAt));
  const activeProjectIds = new Set(
    [...attention, ...running].map((thread) => thread.latestRun.projectId),
  );
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const projectsByActivity = [...projects].sort(
    (a, b) => projectActivity(threads, b.id) - projectActivity(threads, a.id),
  );

  return (
    <AppShell title="Overview">
      <Page>
        <div className="mb-6 flex min-w-0 flex-col items-start gap-3 min-[360px]:flex-row min-[360px]:items-end min-[360px]:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-[.18em] text-glow sm:tracking-[.22em]">
              Live workspace
            </p>
            <h2 className="mt-2 text-xl font-semibold lg:text-2xl">Engineering overview</h2>
            <p className="mt-1 hidden text-sm text-muted sm:block">
              Current conversation threads across your runner projects.
            </p>
          </div>
          <Link
            to="/compose"
            className="flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-glow/30 bg-glow-soft px-4 text-sm font-mono uppercase tracking-wider text-glow min-[360px]:shrink-0"
          >
            <span className="hidden sm:inline">Dispatch task</span>
            <span className="sm:hidden">Dispatch</span>
            <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <section className="mb-6 grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Metric label="Active projects" value={activeProjectIds.size} icon={<FolderGit2 />} />
          <Metric label="Running threads" value={running.length} icon={<CircleDot />} tone="glow" />
          <Metric
            label="Needs input"
            value={threads.filter((thread) => thread.latestRun.status === "needs_input").length}
            icon={<TriangleAlert />}
            tone="alert"
          />
          <Metric
            label="Failed threads"
            value={threads.filter((thread) => thread.latestRun.status === "failed").length}
            icon={<XCircle />}
            tone="danger"
          />
          <Metric label="Completed today" value={completedToday.length} icon={<CheckCircle2 />} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <div className="min-w-0 space-y-6">
            <ThreadSection
              title="Needs your attention"
              threads={attention}
              projects={projectMap}
              empty="No threads need your attention."
              viewAll={attention.length > SECTION_LIMIT}
              collapsible
            />
            <ThreadSection
              title="Running now"
              threads={running}
              projects={projectMap}
              empty="No threads are running right now."
              detail="running"
            />
            <ThreadSection
              title="Recently completed threads"
              threads={completed}
              projects={projectMap}
              empty="No threads have completed yet."
              showDisplayCount
            />
          </div>

          <div className="min-w-0 space-y-6">
            <section>
              <SectionHeading title="Projects" count={projects.length} viewAll="/projects" />
              <div className="grid gap-3">
                {projects.length === 0 ? (
                  <DataState title="No projects yet." />
                ) : (
                  projectsByActivity
                    .slice(0, PROJECT_LIMIT)
                    .map((project) => (
                      <ProjectCard key={project.id} project={project} threads={threads} />
                    ))
                )}
              </div>
            </section>
            <RunnerHealth
              health={healthQuery.data}
              unavailable={healthQuery.isError}
              queued={threads.filter((thread) => thread.latestRun.status === "queued").length}
              running={threads.filter((thread) => thread.latestRun.status === "running").length}
            />
          </div>
        </div>
      </Page>
    </AppShell>
  );
}

const Page = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto w-full min-w-0 max-w-[1440px] px-3 py-5 min-[360px]:px-4 lg:px-8 lg:py-8">
    {children}
  </div>
);

function Metric({
  label,
  value,
  icon,
  tone = "muted",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "muted" | "glow" | "alert" | "danger";
}) {
  const toneClass =
    tone === "glow"
      ? "text-glow"
      : tone === "alert"
        ? "text-alert"
        : tone === "danger"
          ? "text-danger"
          : "text-muted";
  return (
    <div className="min-w-0 rounded-xl border border-edge bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-xs font-mono uppercase leading-5 tracking-wider text-muted">
          {label}
        </span>
        <span className={`${toneClass} [&>svg]:size-3.5 lg:[&>svg]:size-4`}>{icon}</span>
      </div>
      <div className="mt-2 text-xl font-semibold lg:mt-3 lg:text-2xl">{value}</div>
    </div>
  );
}

function SectionHeading({
  title,
  count,
  viewAll,
  meta,
}: {
  title: string;
  count: number;
  viewAll?: "/projects" | "/logs";
  meta?: string;
}) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:gap-3">
      <h2 className="min-w-0 text-xs font-mono uppercase leading-5 tracking-wider text-muted sm:tracking-widest">
        {title}
      </h2>
      {meta ? (
        <span className="max-w-full break-words text-xs font-mono text-muted sm:shrink-0">
          {meta}
        </span>
      ) : viewAll ? (
        <Link
          to={viewAll}
          className="flex min-h-11 items-center text-xs font-mono text-muted hover:text-glow"
        >
          View all
        </Link>
      ) : (
        <span className="text-xs font-mono text-muted">{count}</span>
      )}
    </div>
  );
}

function ThreadSection({
  title,
  threads,
  projects,
  empty,
  viewAll = false,
  detail,
  showDisplayCount = false,
  collapsible = false,
}: {
  title: string;
  threads: ConversationThread[];
  projects: Map<string, Project>;
  empty: string;
  viewAll?: boolean;
  detail?: "running";
  showDisplayCount?: boolean;
  collapsible?: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(threads.length / SECTION_LIMIT));
  const currentPage = Math.min(page, pageCount);
  const firstDisplayed = (currentPage - 1) * SECTION_LIMIT;
  const displayedThreads = threads.slice(firstDisplayed, firstDisplayed + SECTION_LIMIT);

  const sectionContent = (
    <>
      <div className="space-y-3">
        {threads.length === 0 ? (
          <DataState title={empty} />
        ) : (
          displayedThreads.map((thread) => (
            <ThreadCard
              key={thread.key}
              thread={thread}
              project={projects.get(thread.latestRun.projectId)}
              showRunningDetail={detail === "running"}
              archivable={title === "Needs your attention"}
            />
          ))
        )}
      </div>
      {showDisplayCount && pageCount > 1 && (
        <nav
          className="mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3"
          aria-label={`${title} pagination`}
        >
          <Button
            type="button"
            className="h-11 px-3"
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </Button>
          <span className="min-w-0 text-center text-xs font-mono text-muted" aria-live="polite">
            Page {currentPage} of {pageCount}
          </span>
          <Button
            type="button"
            className="h-11 px-3"
            variant="outline"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  );

  if (collapsible) {
    return (
      <section>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="threads" className="border-none">
            <AccordionTrigger className="hover:no-underline py-0 pb-3">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:gap-3 w-full pr-2">
                <h2 className="min-w-0 text-xs font-mono uppercase leading-5 tracking-wider text-muted sm:tracking-widest">
                  {title}
                </h2>
                {viewAll ? (
                  <Link
                    to="/logs"
                    className="flex min-h-11 items-center text-xs font-mono text-muted hover:text-glow"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View all
                  </Link>
                ) : (
                  <span className="text-xs font-mono text-muted">{threads.length}</span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>{sectionContent}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading
        title={title}
        count={threads.length}
        viewAll={viewAll ? "/logs" : undefined}
        meta={
          showDisplayCount
            ? threads.length === 0
              ? "Displaying 0 of 0"
              : `Displaying ${firstDisplayed + 1}–${Math.min(firstDisplayed + SECTION_LIMIT, threads.length)} of ${threads.length}`
            : undefined
        }
      />
      {sectionContent}
    </section>
  );
}

function ThreadCard({
  thread,
  project,
  showRunningDetail,
  archivable,
}: {
  thread: ConversationThread;
  project?: Project;
  showRunningDetail: boolean;
  archivable: boolean;
}) {
  const latest = thread.latestRun;
  const repositoryIds = latest.resolvedRepositoryIds?.length
    ? latest.resolvedRepositoryIds
    : latest.selectedRepositoryIds;
  const repositoryNames = new Map(
    (project ? projectRepositories(project) : []).map((repository) => [
      repository.id,
      repository.name,
    ]),
  );
  const model = typeof latest.model === "string" ? latest.model : undefined;

  return (
    <div className="relative min-w-0 rounded-xl border border-edge bg-surface p-4 hover:border-glow/30">
      <Link
        to="/threads/$threadId"
        params={{ threadId: latest.id }}
        className="absolute inset-0 rounded-xl"
        aria-label={`Open ${jobTitle(thread.initialRun)}`}
      />
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="pointer-events-none min-w-0">
          <div className="mb-1 break-words text-xs font-mono uppercase leading-5 tracking-wider text-muted sm:tracking-widest">
            {project?.name ?? latest.projectId} · {latest.agent}
            {model ? `/${model}` : ""}
          </div>
          <div className="break-words text-base font-medium leading-6">
            {jobTitle(thread.initialRun)}
          </div>
          {showRunningDetail && (
            <div className="mt-2 break-words text-sm leading-5 text-muted">
              {jobTitle(latest)} · {repositoryIds.length} repo
              {repositoryIds.length === 1 ? "" : "s"}
              {repositoryIds.length > 0
                ? ` (${repositoryIds.map((id) => repositoryNames.get(id) ?? id).join(", ")})`
                : ""}
            </div>
          )}
          <div className="mt-2 break-words text-xs font-mono leading-5 text-muted">
            {formatTime(thread.activityAt)} · {thread.runCount}{" "}
            {thread.runCount === 1 ? "run" : "runs"}
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
          <StatusDot status={latest.status} />
          <StatusPill status={latest.status} />
          {archivable && (
            <div className="relative z-10">
              <ArchiveThreadButton
                threadId={latest.id}
                active={["queued", "running", "needs_input"].includes(latest.status)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, threads }: { project: Project; threads: ConversationThread[] }) {
  const projectThreads = threads.filter((thread) => thread.latestRun.projectId === project.id);
  const running = projectThreads.filter((thread) =>
    isRunningThread(thread.latestRun.status),
  ).length;
  const attention = projectThreads.filter((thread) =>
    needsThreadAttention(thread.latestRun.status),
  ).length;
  const lastActivity = projectThreads[0]?.activityAt;
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="group min-w-0 rounded-xl border border-edge bg-surface p-4 hover:border-glow/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-base font-medium leading-6">{project.name}</div>
          <div className="mt-1 break-words text-xs font-mono leading-5 text-muted">
            {projectRepositories(project).length} repos · {running} running · {attention} attention
          </div>
          <div className="mt-2 break-words text-xs font-mono leading-5 text-muted">
            Last activity {lastActivity ? formatTime(lastActivity) : "—"}
          </div>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted group-hover:text-glow" />
      </div>
    </Link>
  );
}

function RunnerHealth({
  health,
  unavailable,
  queued,
  running,
}: {
  health?: Record<string, unknown>;
  unavailable: boolean;
  queued: number;
  running: number;
}) {
  const reportedStatus = health?.status ?? health?.state;
  const status = unavailable
    ? "Unavailable"
    : typeof reportedStatus === "string"
      ? reportedStatus
      : health
        ? "Healthy"
        : "Checking…";
  return (
    <section>
      <SectionHeading title="Runner health" count={queued + running} />
      <div className="min-w-0 rounded-xl border border-edge bg-surface p-4">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Activity className={unavailable ? "size-4 text-danger" : "size-4 text-glow"} />
            <span className="text-sm font-medium capitalize">{status}</span>
          </div>
          <span className="break-words text-xs font-mono uppercase leading-5 tracking-wider text-muted sm:text-right sm:tracking-widest">
            Public health endpoint
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-edge pt-4 text-center">
          <div className="min-w-0">
            <div className="text-lg font-semibold">{queued}</div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted">Queued</div>
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold">{running}</div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted">Running</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function projectActivity(threads: ConversationThread[], projectId: string) {
  const activity = threads.find((thread) => thread.latestRun.projectId === projectId)?.activityAt;
  return Date.parse(activity ?? "") || 0;
}

function isToday(value?: string) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
