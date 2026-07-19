import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusDot, threadStatusLabel } from "@/components/StatusPill";
import { threads, projectById } from "@/lib/mock-data";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Logs — Command Center" },
      { name: "description", content: "Raw agent activity across every thread." },
    ],
  }),
  component: LogsPage,
});

function LogsPage() {
  return (
    <AppShell title="Agent logs">
      <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">Agent_Stream</h2>
            <p className="mt-2 hidden text-sm text-muted lg:block">Live activity across every project and repository.</p>
          </div>
          <div className="flex gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-edge bg-surface px-3 lg:w-64">
              <Search className="size-3.5 text-muted" />
              <input placeholder="Search activity" className="min-w-0 flex-1 bg-transparent text-xs placeholder:text-muted focus:outline-none" />
            </label>
            <button className="flex size-10 items-center justify-center rounded-lg border border-edge bg-surface text-muted hover:text-foreground"><SlidersHorizontal className="size-4" /></button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-edge bg-surface">
          <div className="hidden grid-cols-[110px_180px_160px_minmax(260px,1fr)_140px_100px] gap-4 border-b border-edge bg-void/60 px-5 py-3 text-[9px] font-mono uppercase tracking-widest text-muted lg:grid">
            <span>Updated</span><span>Project</span><span>Repository</span><span>Activity</span><span>Agent</span><span>Status</span>
          </div>
          {threads.map((t) => {
            const project = projectById(t.projectId);
            return (
              <Link
                key={t.id}
                to="/threads/$threadId"
                params={{ threadId: t.id }}
                className="block border-b border-edge px-4 py-4 transition-colors last:border-b-0 hover:bg-glow-soft/40 lg:grid lg:grid-cols-[110px_180px_160px_minmax(260px,1fr)_140px_100px] lg:items-center lg:gap-4 lg:px-5"
              >
                <div className="text-[9px] font-mono text-glow">{t.updatedAt}</div>
                <div className="mt-1 truncate text-xs lg:mt-0">{project?.name}</div>
                <div className="mt-2 flex flex-wrap gap-1 lg:mt-0 lg:block lg:truncate">
                  {t.repoScope.map((repo) => <span key={repo} className="mr-1 text-[9px] font-mono text-muted">{repo}</span>)}
                </div>
                <div className="mt-2 truncate text-xs lg:mt-0">{t.currentAction ?? t.summary ?? t.question ?? t.failureMessage ?? t.title}</div>
                <div className="mt-2 text-[9px] font-mono text-muted lg:mt-0">{t.agent}</div>
                <div className="mt-2 flex items-center gap-2 lg:mt-0"><StatusDot status={t.status} /><span className="text-[9px] font-mono text-muted">{threadStatusLabel[t.status]}</span></div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
