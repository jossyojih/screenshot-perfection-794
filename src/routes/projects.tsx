import { createFileRoute, Link } from "@tanstack/react-router";
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
      <div className="px-4 py-4 space-y-3">
        <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest mb-1">
          All_Projects
        </h2>
        {projects.map((p) => {
          const projectThreads = threads.filter((t) => t.projectId === p.id);
          const active = projectThreads.filter((t) => t.status !== "done").length;
          return (
            <Link
              key={p.id}
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className={`block p-4 rounded-xl border border-edge bg-surface hover:border-glow/30 transition-colors ${
                p.paused ? "opacity-70" : ""
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-[10px] text-muted font-mono mt-0.5">
                    {p.repos.length} repo{p.repos.length > 1 ? "s" : ""} ·{" "}
                    {p.repos.join(", ")}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
                  {p.paused ? "Paused" : `${active} active`}
                </span>
              </div>
              <div className="w-full h-1 bg-edge rounded-full overflow-hidden">
                <div
                  className="h-full bg-glow shadow-[var(--shadow-glow-soft)]"
                  style={{ width: `${p.paused ? 0 : p.progress}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
