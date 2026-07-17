import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { projectById, threads } from "@/lib/mock-data";

export const Route = createFileRoute("/projects/$projectId")({
  loader: ({ params }) => {
    const project = projectById(params.projectId);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Project not found" }, { name: "robots", content: "noindex" }] };
    }
    return {
      meta: [
        { title: `${loaderData.project.name} — Command Center` },
        {
          name: "description",
          content: `Threads and status for ${loaderData.project.name}.`,
        },
      ],
    };
  },
  notFoundComponent: () => (
    <AppShell>
      <div className="p-6 text-center text-muted text-sm">Project not found.</div>
    </AppShell>
  ),
  errorComponent: () => (
    <AppShell>
      <div className="p-6 text-center text-muted text-sm">Something went wrong.</div>
    </AppShell>
  ),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { project } = Route.useLoaderData();
  const projectThreads = threads.filter((t) => t.projectId === project.id);

  return (
    <AppShell
      title={project.name}
      headerRight={
        <Link
          to="/projects"
          className="text-[10px] font-mono text-muted uppercase tracking-widest hover:text-foreground"
        >
          ← All
        </Link>
      }
    >
      <div className="px-4 py-4 space-y-5">
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-mono uppercase text-muted tracking-widest">
              Workspace
            </div>
            <span className="text-[10px] font-mono text-muted">
              {project.paused ? "Paused" : `${project.progress}% complete`}
            </span>
          </div>
          <div className="p-4 rounded-xl border border-edge bg-surface">
            <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-2">
              Repositories
            </div>
            <ul className="space-y-1">
              {project.repos.map((r) => (
                <li key={r} className="font-mono text-sm">
                  <span className="text-muted">›</span> {r}
                </li>
              ))}
            </ul>
            <div className="w-full h-1 mt-4 bg-edge rounded-full overflow-hidden">
              <div
                className="h-full bg-glow shadow-[var(--shadow-glow-soft)]"
                style={{ width: `${project.paused ? 0 : project.progress}%` }}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest">
            Threads
          </h2>
          {projectThreads.length === 0 && (
            <p className="text-sm text-muted">No threads yet. Send a task to start one.</p>
          )}
          {projectThreads.map((t) => (
            <Link
              key={t.id}
              to="/threads/$threadId"
              params={{ threadId: t.id }}
              className="block p-4 bg-surface border border-edge rounded-xl hover:border-glow/30 transition-colors"
            >
              <div className="flex justify-between items-start gap-3 mb-1">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusDot status={t.status} />
                  <StatusPill status={t.status} />
                </div>
              </div>
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest">
                {t.agent} · {t.updatedAt}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
