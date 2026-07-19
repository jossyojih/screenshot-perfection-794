import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, CircleDot, FolderGit2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
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
    <AppShell title="Overview">
      <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">
        <div className="mb-6 hidden items-end justify-between lg:flex">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-glow">Live workspace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Engineering overview</h2>
            <p className="mt-1 text-sm text-muted">Monitor projects, repositories, and agent work from one place.</p>
          </div>
          <Link
            to="/compose"
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-glow hover:text-foreground"
          >
            Dispatch task <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <section className="mb-6 hidden grid-cols-4 gap-3 lg:grid">
          <Metric label="Active projects" value={projects.filter((p) => !p.paused).length} icon={<FolderGit2 />} />
          <Metric label="Running agents" value={running.length} icon={<CircleDot />} tone="glow" />
          <Metric label="Needs attention" value={blocked.length} icon={<TriangleAlert />} tone="alert" />
          <Metric label="Completed" value={done.length} icon={<CheckCircle2 />} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="space-y-6">
            <section>
              <SectionHeading title="Action_Required" meta={`${blocked.length} blocked`} />
              {blocked.length === 0 ? (
                <div className="rounded-xl border border-dashed border-edge p-5 text-center text-xs text-muted">
                  All clear. No agents waiting on you.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {blocked.map((t) => <BlockedCard key={t.id} thread={t} />)}
                </div>
              )}
            </section>

            <section>
              <SectionHeading title="Active_Threads" meta={`${running.length} running`} />
              <div className="space-y-3">
                {running.map((t) => <ThreadCard key={t.id} thread={t} />)}
                {done.slice(0, 2).map((t) => <ThreadCard key={t.id} thread={t} subdued />)}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">Projects</h2>
                <Link to="/projects" className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-foreground">View all</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {projects.map((p) => (
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    key={p.id}
                    className={`group rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-glow/40 ${p.paused ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="mt-1 text-[10px] font-mono text-muted">
                          {p.repos.length} {p.repos.length === 1 ? "repository" : "repositories"}
                        </div>
                      </div>
                      <ArrowUpRight className="size-4 text-muted transition-colors group-hover:text-glow" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {p.repos.map((repo) => (
                        <span key={repo} className="rounded border border-edge bg-void/70 px-2 py-1 text-[9px] font-mono text-muted">{repo}</span>
                      ))}
                    </div>
                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-edge">
                      <div className="h-full bg-glow shadow-[var(--shadow-glow-soft)]" style={{ width: `${p.paused ? 0 : p.progress}%` }} />
                    </div>
                    <div className="mt-2 text-right text-[9px] font-mono text-muted">{p.paused ? "Paused" : `${p.progress}% complete`}</div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-edge bg-surface/60 p-4">
              <SectionHeading title="Runner_Status" meta="Healthy" />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <InfoCell label="Region" value="eu-west-2" />
                <InfoCell label="Host" value="Ubuntu 24.04" />
                <InfoCell label="Codex" value="v0.144.6" />
                <InfoCell label="Workspace" value="3 projects" />
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, icon, tone = "muted" }: { label: string; value: number; icon: ReactNode; tone?: "muted" | "glow" | "alert" }) {
  const color = tone === "glow" ? "text-glow" : tone === "alert" ? "text-alert" : "text-muted";
  return (
    <div className="rounded-xl border border-edge bg-surface/70 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">{label}</span>
        <span className={`${color} [&>svg]:size-4`}>{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function SectionHeading({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">{title}</h2>
      <span className="text-[10px] font-mono text-muted">{meta}</span>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-edge bg-void/55 p-3">
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-1.5 truncate font-mono text-[11px]">{value}</div>
    </div>
  );
}

function ThreadCard({ thread: t, subdued = false }: { thread: Thread; subdued?: boolean }) {
  const project = projectById(t.projectId);
  return (
    <Link
      to="/threads/$threadId"
      params={{ threadId: t.id }}
      className={`block rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-glow/30 ${subdued ? "opacity-70 hover:opacity-100" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-mono uppercase tracking-widest text-muted">{project?.name} · {t.agent}</div>
          <div className="truncate text-sm font-medium">{t.title}</div>
          {t.currentAction && <div className="mt-3 truncate rounded border border-edge/60 bg-void/60 p-2 font-mono text-[10px] text-muted">{t.currentAction}</div>}
          {t.stats && <div className="mt-2 text-[10px] font-mono text-muted">{t.stats}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2"><StatusDot status={t.status} /><StatusPill status={t.status} /></div>
      </div>
    </Link>
  );
}

function BlockedCard({ thread: t }: { thread: Thread }) {
  const project = projectById(t.projectId);
  const isFail = t.status === "failed";
  const tone = isFail ? "bg-danger-soft border-danger/50" : "bg-alert-soft border-alert/40";
  const accent = isFail ? "text-danger" : "text-alert";
  const body = isFail ? t.failureMessage ?? "Agent halted." : t.question ?? "";

  return (
    <Link to="/threads/$threadId" params={{ threadId: t.id }} className={`block rounded-xl border p-4 ${tone}`}>
      <div className={`mb-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest ${accent}`}>
        <span>{isFail ? "FAILED" : "NEEDS INPUT"} · {project?.name}</span>
        <StatusDot status={t.status} />
      </div>
      <div className="mb-2 text-sm font-medium leading-snug">{t.title}</div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted">{body}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted">{t.agent} · {t.updatedAt}</span>
        <span className={`text-[10px] font-mono uppercase tracking-widest ${accent}`}>{isFail ? "Hand off →" : "Reply →"}</span>
      </div>
    </Link>
  );
}
