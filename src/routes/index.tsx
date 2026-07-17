import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { projects, threads, projectById } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Feed — Command Center" },
      {
        name: "description",
        content: "Active threads and recent projects. Direct your remote coding agents at a glance.",
      },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const needsInput = threads.filter((t) => t.status === "needs_input");
  const running = threads.filter((t) => t.status === "running");
  const done = threads.filter((t) => t.status === "done");

  return (
    <AppShell>
      <div className="px-4 py-4 space-y-6">
        {/* Projects strip */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest">
              Recent_Projects
            </h2>
            <Link to="/projects" className="text-[10px] text-muted underline underline-offset-2">
              View all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {projects.map((p) => (
              <Link
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                key={p.id}
                className={`shrink-0 w-36 p-3 bg-surface border border-edge rounded-lg hover:border-glow/40 transition-colors ${
                  p.paused ? "opacity-60" : ""
                }`}
              >
                <div className="text-xs font-medium mb-1 truncate">{p.name}</div>
                <div className="text-[10px] text-muted font-mono">
                  {p.paused ? "Paused" : `${p.progress}% complete`}
                </div>
                <div className="mt-3 w-full h-1 bg-edge rounded-full overflow-hidden">
                  <div
                    className="h-full bg-glow shadow-[var(--shadow-glow-soft)]"
                    style={{ width: `${p.paused ? 0 : p.progress}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Needs input */}
        {needsInput.map((t) => {
          const project = projectById(t.projectId);
          return (
            <section key={t.id}>
              <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest mb-3">
                Action_Required
              </h2>
              <Link
                to="/threads/$threadId"
                params={{ threadId: t.id }}
                className="block p-4 bg-alert-soft border border-alert/40 rounded-xl relative overflow-hidden"
              >
                <div className="absolute top-3 right-3">
                  <StatusDot status={t.status} />
                </div>
                <div className="text-[10px] font-mono text-alert mb-2 uppercase tracking-widest">
                  {project?.name} · {t.agent}
                </div>
                <div className="text-sm font-medium leading-snug mb-2 pr-6">{t.title}</div>
                <p className="text-xs text-muted leading-relaxed line-clamp-2">{t.question}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-muted font-mono">Modified {t.updatedAt}</span>
                  <span className="text-[10px] font-mono text-alert uppercase tracking-widest">
                    Reply →
                  </span>
                </div>
              </Link>
            </section>
          );
        })}

        {/* Active */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest">
            Active_Threads
          </h2>
          {running.map((t) => {
            const project = projectById(t.projectId);
            return (
              <Link
                key={t.id}
                to="/threads/$threadId"
                params={{ threadId: t.id }}
                className="block p-4 bg-surface border border-edge rounded-xl hover:border-glow/30 transition-colors"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div>
                    <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">
                      {project?.name} · {t.agent}
                    </div>
                    <div className="text-sm font-medium">{t.title}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusDot status={t.status} />
                    <StatusPill status={t.status} />
                  </div>
                </div>
                {t.currentAction && (
                  <div className="font-mono text-[10px] text-muted/80 bg-void/60 border border-edge/60 p-2 rounded mb-3 overflow-hidden whitespace-nowrap">
                    {t.currentAction}
                  </div>
                )}
                {t.tags && (
                  <div className="flex gap-2 flex-wrap">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full border border-edge bg-void text-[9px] text-muted font-mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </section>

        {/* Done */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest">
            Recently_Done
          </h2>
          {done.map((t) => {
            const project = projectById(t.projectId);
            return (
              <Link
                key={t.id}
                to="/threads/$threadId"
                params={{ threadId: t.id }}
                className="block p-4 bg-surface/60 border border-edge/60 rounded-xl opacity-80 hover:opacity-100 transition-opacity"
              >
                <div className="flex justify-between items-start gap-3 mb-1">
                  <div>
                    <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">
                      {project?.name} · {t.updatedAt}
                    </div>
                    <div className="text-sm font-medium">{t.title}</div>
                  </div>
                  <StatusPill status={t.status} />
                </div>
                {t.stats && (
                  <div className="text-[10px] text-muted font-mono mt-1">{t.stats}</div>
                )}
              </Link>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
