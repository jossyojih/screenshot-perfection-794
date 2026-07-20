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
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
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
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[.22em] text-glow">
              Live workspace
            </p>
            <h2 className="mt-2 text-xl font-semibold lg:text-2xl">Engineering overview</h2>
            <p className="mt-1 hidden text-sm text-muted sm:block">
              Current conversation threads across your runner projects.
            </p>
          </div>
          <Link
            to="/compose"
            className="flex shrink-0 items-center gap-2 text-xs font-mono uppercase tracking-widest text-glow"
          >
            <span className="hidden sm:inline">Dispatch task</span>
            <span className="sm:hidden">Dispatch</span>
            <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3">
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
          <div className="space-y-6">
            <ThreadSection
              title="Needs your attention"
              threads={attention}
              projects={projectMap}
              empty="No threads need your attention."
              viewAll={attention.length > SECTION_LIMIT}
            />
            <ThreadSection
              title="Running now"
              threads={running}
              projects={projectMap}
              empty="No threads are running right now."
              detail="running"
            />
            <ThreadSection
              title="Recently completed"
              threads={completed}
              projects={projectMap}
              empty="No threads have completed yet."
            />
          </div>

          <div className="space-y-6">
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
  <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">{children}</div>
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
    <div className="rounded-xl border border-edge bg-surface/70 p-3 lg:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] font-mono uppercase tracking-wider text-muted lg:text-[10px] lg:tracking-widest">
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
}: {
  title: string;
  count: number;
  viewAll?: "/projects" | "/logs";
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">{title}</h2>
      {viewAll ? (
        <Link to={viewAll} className="text-[10px] font-mono text-muted hover:text-glow">
          View all
        </Link>
      ) : (
        <span className="text-[10px] font-mono text-muted">{count}</span>
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
}: {
  title: string;
  threads: ConversationThread[];
  projects: Map<string, Project>;
  empty: string;
  viewAll?: boolean;
  detail?: "running";
}) {
  return (
    <section>
      <SectionHeading
        title={title}
        count={threads.length}
        viewAll={viewAll ? "/logs" : undefined}
      />
      <div className="space-y-3">
        {threads.length === 0 ? (
          <DataState title={empty} />
        ) : (
          threads
            .slice(0, SECTION_LIMIT)
            .map((thread) => (
              <ThreadCard
                key={thread.key}
                thread={thread}
                project={projects.get(thread.latestRun.projectId)}
                showRunningDetail={detail === "running"}
              />
            ))
        )}
      </div>
    </section>
  );
}

function ThreadCard({
  thread,
  project,
  showRunningDetail,
}: {
  thread: ConversationThread;
  project?: Project;
  showRunningDetail: boolean;
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
    <Link
      to="/threads/$threadId"
      params={{ threadId: latest.id }}
      className="block rounded-xl border border-edge bg-surface p-4 hover:border-glow/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted">
            {project?.name ?? latest.projectId} · {latest.agent}
            {model ? `/${model}` : ""}
          </div>
          <div className="truncate text-sm font-medium">{jobTitle(thread.initialRun)}</div>
          {showRunningDetail && (
            <div className="mt-2 line-clamp-1 text-xs text-muted">
              {jobTitle(latest)} · {repositoryIds.length} repo
              {repositoryIds.length === 1 ? "" : "s"}
              {repositoryIds.length > 0
                ? ` (${repositoryIds.map((id) => repositoryNames.get(id) ?? id).join(", ")})`
                : ""}
            </div>
          )}
          <div className="mt-2 text-[9px] font-mono text-muted">
            {formatTime(thread.activityAt)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusDot status={latest.status} />
          <StatusPill status={latest.status} />
        </div>
      </div>
    </Link>
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
      className="group rounded-xl border border-edge bg-surface p-4 hover:border-glow/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{project.name}</div>
          <div className="mt-1 text-[10px] font-mono text-muted">
            {projectRepositories(project).length} repos · {running} running · {attention} attention
          </div>
          <div className="mt-2 text-[9px] font-mono text-muted">
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
      <div className="rounded-xl border border-edge bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className={unavailable ? "size-4 text-danger" : "size-4 text-glow"} />
            <span className="text-sm font-medium capitalize">{status}</span>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted">
            Public health endpoint
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-edge pt-4 text-center">
          <div>
            <div className="text-lg font-semibold">{queued}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted">Queued</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{running}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted">Running</div>
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
