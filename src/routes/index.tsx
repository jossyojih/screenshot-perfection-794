import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { projects, threads, projectById } from "@/lib/mock-data";
import type { Thread } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Feed — Command Center" },
      {
        name: "description",
        content: "Action-required threads and recent project status for your remote coding agents.",
      },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const blocked = threads.filter((t) => t.status === "needs_input" || t.status === "failed");
  const running = threads.filter((t) => t.status === "running");
  const done = threads.filter((t) => t.status === "done");

  return (
    <AppShell>
      <div className="px-4 py-4 space-y-6">
        {/* Action Required — needs_input + failed */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest">
              Action_Required
            </h2>
            <span className="text-[10px] font-mono text-muted">{blocked.length} blocked</span>
          </div>
          {blocked.length === 0 && (
            <div className="p-4 rounded-xl border border-dashed border-edge text-center text-xs text-muted">
              All clear. No agents waiting on you.
            </div>
          )}
          <div className="space-y-3">
            {blocked.map((t) => (
              <BlockedCard key={t.id} thread={t} />
            ))}
          </div>
        </section>

        {/* Recent Projects strip */}
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

        {/* Recent Threads — running + done */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest">
            Recent_Threads
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
                {t.stats && <div className="text-[10px] text-muted font-mono mt-1">{t.stats}</div>}
              </Link>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}

function BlockedCard({ thread: t }: { thread: Thread }) {
  const project = projectById(t.projectId);
  const isFail = t.status === "failed";
  const tone = isFail
    ? "bg-danger-soft border-danger/50"
    : "bg-alert-soft border-alert/40";
  const accent = isFail ? "text-danger" : "text-alert";
  const cta = isFail ? "Hand off →" : "Reply →";
  const body = isFail
    ? t.failureMessage ?? "Agent halted."
    : t.question ?? "";
  const kindLabel = isFail
    ? t.failureKind === "rate_limit"
      ? "FAILED · RATE LIMIT"
      : "FAILED · CRASHED"
    : "NEEDS INPUT";

  return (
    <Link
      to="/threads/$threadId"
      params={{ threadId: t.id }}
      className={`block p-4 border rounded-xl relative overflow-hidden ${tone}`}
    >
      <div className="absolute top-3 right-3">
        <StatusDot status={t.status} />
      </div>
      <div className={`text-[10px] font-mono mb-2 uppercase tracking-widest ${accent}`}>
        {kindLabel} · {project?.name} · {t.agent}
      </div>
      <div className="text-sm font-medium leading-snug mb-2 pr-6">{t.title}</div>
      <p className="text-xs text-muted leading-relaxed line-clamp-2">{body}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-muted font-mono">Updated {t.updatedAt}</span>
        <span className={`text-[10px] font-mono uppercase tracking-widest ${accent}`}>{cta}</span>
      </div>
    </Link>
  );
}
