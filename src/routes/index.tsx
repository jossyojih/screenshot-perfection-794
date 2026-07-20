import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, CircleDot, FolderGit2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import {
  formatTime,
  getJobs,
  getProjects,
  jobTitle,
  projectRepositories,
  type Job,
  type Project,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Overview — Command Center" }] }),
  component: FeedPage,
});
function FeedPage() {
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const jobsQuery = useQuery({ queryKey: ["jobs"], queryFn: getJobs, refetchInterval: 5000 });
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
  const attention = jobs.filter((j) => j.status === "needs_input" || j.status === "failed");
  const running = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const done = jobs.filter((j) => j.status === "done");
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  return (
    <AppShell title="Overview">
      <Page>
        <div className="mb-6 hidden items-end justify-between lg:flex">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[.22em] text-glow">
              Live workspace
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Engineering overview</h2>
            <p className="mt-1 text-sm text-muted">Real-time runner projects and agent work.</p>
          </div>
          <Link
            to="/compose"
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-glow"
          >
            Dispatch task <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <section className="mb-6 hidden grid-cols-4 gap-3 lg:grid">
          <Metric label="Projects" value={projects.length} icon={<FolderGit2 />} />
          <Metric label="Running" value={running.length} icon={<CircleDot />} tone="glow" />
          <Metric
            label="Needs attention"
            value={attention.length}
            icon={<TriangleAlert />}
            tone="alert"
          />
          <Metric label="Completed" value={done.length} icon={<CheckCircle2 />} />
        </section>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <div className="space-y-6">
            <JobSection
              title="Action_Required"
              jobs={attention}
              projects={projectMap}
              empty="No jobs need attention."
            />
            <JobSection
              title="Recent_Jobs"
              jobs={[...running, ...done].slice(0, 8)}
              projects={projectMap}
              empty="No jobs have been dispatched yet."
            />
          </div>
          <section>
            <div className="mb-3 flex justify-between">
              <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">
                Projects
              </h2>
              <Link to="/projects" className="text-[10px] font-mono text-muted">
                View all
              </Link>
            </div>
            <div className="grid gap-3">
              {projects.length === 0 ? (
                <DataState title="No projects yet." />
              ) : (
                projects.map((p) => <ProjectCard key={p.id} project={p} />)
              )}
            </div>
          </section>
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
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface/70 p-4">
      <div className="flex justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">{label}</span>
        <span
          className={`${tone === "glow" ? "text-glow" : tone === "alert" ? "text-alert" : "text-muted"} [&>svg]:size-4`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </div>
  );
}
function JobSection({
  title,
  jobs,
  projects,
  empty,
}: {
  title: string;
  jobs: Job[];
  projects: Map<string, Project>;
  empty: string;
}) {
  return (
    <section>
      <div className="mb-3 flex justify-between">
        <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">{title}</h2>
        <span className="text-[10px] font-mono text-muted">{jobs.length}</span>
      </div>
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <DataState title={empty} />
        ) : (
          jobs.map((j) => (
            <Link
              key={j.id}
              to="/threads/$threadId"
              params={{ threadId: j.id }}
              className="block rounded-xl border border-edge bg-surface p-4 hover:border-glow/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted">
                    {projects.get(j.projectId)?.name ?? j.projectId} · {j.agent}
                  </div>
                  <div className="truncate text-sm font-medium">{jobTitle(j)}</div>
                  <div className="mt-2 text-[9px] font-mono text-muted">
                    {formatTime(j.updatedAt ?? j.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={j.status} />
                  <StatusPill status={j.status} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
function ProjectCard({ project: p }: { project: Project }) {
  const repos = projectRepositories(p);
  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: p.id }}
      className="group rounded-xl border border-edge bg-surface p-4 hover:border-glow/40"
    >
      <div className="flex justify-between">
        <div>
          <div className="text-sm font-medium">{p.name}</div>
          <div className="mt-1 text-[10px] font-mono text-muted">{repos.length} repositories</div>
        </div>
        <ArrowUpRight className="size-4 text-muted group-hover:text-glow" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {repos.map((r) => (
          <span
            key={r.id}
            className="rounded border border-edge bg-void/70 px-2 py-1 text-[9px] font-mono text-muted"
          >
            {r.name}
          </span>
        ))}
      </div>
    </Link>
  );
}
