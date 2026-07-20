import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { formatTime, getJobs, getProject, jobTitle, projectRepositories } from "@/lib/api";
export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({ meta: [{ title: "Project — Command Center" }] }),
  component: ProjectDetail,
});
function ProjectDetail() {
  const { projectId } = Route.useParams();
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: getJobs, refetchInterval: 5000 });
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
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[.2em] text-glow">
              <span className="size-1.5 rounded-full bg-glow" />
              Project
            </div>
            <h2 className="mt-2 text-xl font-semibold lg:text-2xl">{p.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {p.description ?? `Coordinating ${repos.length} repositories.`}
            </p>
          </div>
          <Link
            to="/compose"
            search={{ projectId: p.id, threadId: undefined }}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-glow px-4 text-xs font-bold uppercase tracking-widest text-void"
          >
            <Plus className="size-4" /> New instruction
          </Link>
        </div>
        <div className="space-y-6">
          <section>
            <Heading title="Repositories" meta={`${repos.length} connected`} />
            {repos.length === 0 ? (
              <DataState title="No repositories are connected to this project." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {repos.map((r) => (
                  <div key={r.id} className="rounded-xl border border-edge bg-surface p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-glow/25 bg-glow-soft text-glow">
                      <GitBranch className="size-4" />
                    </span>
                    <div className="mt-4 truncate text-sm font-medium">{r.name}</div>
                    <div className="mt-1 text-[9px] font-mono text-muted">
                      {r.defaultBranch ?? "default branch"}
                      {r.status ? ` · ${r.status}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <Heading title="Jobs" meta={`${projectJobs.length} total`} />
            {jobs.isPending ? (
              <LoadingState />
            ) : jobs.isError ? (
              <ErrorState error={jobs.error} retry={() => jobs.refetch()} />
            ) : projectJobs.length === 0 ? (
              <DataState title="No jobs yet. Send a task to start one." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-edge bg-surface">
                {projectJobs.map((j) => (
                  <Link
                    key={j.id}
                    to="/threads/$threadId"
                    params={{ threadId: j.id }}
                    className="group block border-b border-edge p-4 last:border-0 hover:bg-glow-soft/50 lg:p-5"
                  >
                    <div className="flex justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{jobTitle(j)}</div>
                        <div className="mt-3 text-[9px] font-mono uppercase tracking-widest text-muted">
                          {j.agent} · {formatTime(j.updatedAt ?? j.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusDot status={j.status} />
                        <StatusPill status={j.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </Page>
    </AppShell>
  );
}
const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">{children}</div>
);
const Heading = ({ title, meta }: { title: string; meta: string }) => (
  <div className="mb-3 flex justify-between">
    <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted">{title}</h3>
    <span className="text-[10px] font-mono text-muted">{meta}</span>
  </div>
);
