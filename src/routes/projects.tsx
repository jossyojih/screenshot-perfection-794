import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, FolderGit2, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { projects, threads } from "@/lib/mock-data";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Command Center" },
      { name: "description", content: "All projects wired to your remote workspace." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <AppShell title="Projects">
      <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">All_Projects</h2>
            <p className="mt-2 hidden text-sm text-muted lg:block">Each project can coordinate work across one or many repositories.</p>
          </div>
          <button className="hidden h-10 items-center gap-2 rounded-lg border border-edge bg-surface px-4 text-xs font-medium hover:border-glow/40 lg:flex">
            <Plus className="size-4 text-glow" /> Add project
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {projects.map((p) => {
            const projectThreads = threads.filter((t) => t.projectId === p.id);
            const active = projectThreads.filter((t) => t.status !== "done").length;
            return (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                className={`group block rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-glow/40 ${p.paused ? "opacity-70" : ""}`}
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium"><FolderGit2 className="size-4 text-glow" />{p.name}</div>
                    <div className="mt-1.5 text-[10px] font-mono text-muted">{p.repos.length} repo{p.repos.length > 1 ? "s" : ""}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted">{p.paused ? "Paused" : `${active} active`}</span>
                    <ArrowUpRight className="size-4 text-muted group-hover:text-glow" />
                  </div>
                </div>
                <div className="mb-5 flex min-h-12 flex-wrap content-start gap-1.5">
                  {p.repos.map((repo) => <span key={repo} className="rounded border border-edge bg-void/60 px-2 py-1 text-[9px] font-mono text-muted">{repo}</span>)}
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-edge">
                  <div className="h-full bg-glow shadow-[var(--shadow-glow-soft)]" style={{ width: `${p.paused ? 0 : p.progress}%` }} />
                </div>
                <div className="mt-2 text-right text-[9px] font-mono text-muted">{p.paused ? "No active work" : `${p.progress}% complete`}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
