import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, FolderGit2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { getJobs, getProjects, projectRepositories } from "@/lib/api";
import { groupJobsByThread } from "@/lib/threads";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects — Command Center" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const matchRoute = useMatchRoute();
  const projectDetailMatch = matchRoute({ to: "/projects/$projectId" });

  return projectDetailMatch ? <Outlet /> : <ProjectsList />;
}

function ProjectsList() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: getJobs });
  const threads = groupJobsByThread(jobs.data ?? []);
  return (
    <AppShell title="Projects">
      <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">
              All_Projects
            </h2>
            <p className="mt-2 hidden text-sm text-muted lg:block">
              Each project can coordinate work across one or many repositories.
            </p>
          </div>
          <CreateProjectDialog />
        </div>
        {projects.isPending ? (
          <LoadingState />
        ) : projects.isError ? (
          <ErrorState error={projects.error} retry={() => projects.refetch()} />
        ) : projects.data.length === 0 ? (
          <DataState title="No projects yet. Create one through the runner API to get started." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {projects.data.map((p) => {
              const repos = projectRepositories(p);
              const active = threads.filter(
                (thread) =>
                  thread.latestRun.projectId === p.id &&
                  ["queued", "running", "needs_input"].includes(thread.latestRun.status),
              ).length;
              return (
                <Link
                  key={p.id}
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="group block rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-glow/40"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FolderGit2 className="size-4 text-glow" />
                        {p.name}
                      </div>
                      <div className="mt-1.5 text-[10px] font-mono text-muted">
                        {repos.length === 0 ? (
                          <span className="text-alert">Setup required</span>
                        ) : (
                          `${repos.length} repo${repos.length === 1 ? "" : "s"}`
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                        {active} active
                      </span>
                      <ArrowUpRight className="size-4 text-muted group-hover:text-glow" />
                    </div>
                  </div>
                  <div className="flex min-h-12 flex-wrap content-start gap-1.5">
                    {repos.map((repo) => (
                      <span
                        key={repo.id}
                        className="rounded border border-edge bg-void/60 px-2 py-1 text-[9px] font-mono text-muted"
                      >
                        {repo.name}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
