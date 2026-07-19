import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { GitBranch, Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { AGENTS, MODELS_BY_AGENT, projectById, threads, updateProjectDefaults } from "@/lib/mock-data";
import type { AgentName } from "@/lib/mock-data";

export const Route = createFileRoute("/projects/$projectId")({
  loader: ({ params }) => {
    const project = projectById(params.projectId);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.project.name} — Command Center` },
      { name: "description", content: `Threads and status for ${loaderData.project.name}.` },
    ] : [{ title: "Project not found" }],
  }),
  notFoundComponent: () => <AppShell><div className="p-6 text-center text-sm text-muted">Project not found.</div></AppShell>,
  errorComponent: () => <AppShell><div className="p-6 text-center text-sm text-muted">Something went wrong.</div></AppShell>,
  component: ProjectDetail,
});

function ProjectDetail() {
  const { project } = Route.useLoaderData();
  const projectThreads = threads.filter((t) => t.projectId === project.id);
  const [agent, setAgent] = useState<AgentName>(project.defaultAgent);
  const [model, setModel] = useState(project.defaultModel);
  const [editing, setEditing] = useState(false);
  const save = () => { updateProjectDefaults(project.id, agent, model); setEditing(false); };

  return (
    <AppShell
      title={project.name}
      headerRight={<Link to="/projects" className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-foreground">← Projects</Link>}
    >
      <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-glow"><span className="size-1.5 rounded-full bg-glow" />{project.paused ? "Paused" : "Active project"}</div>
            <h2 className="mt-2 text-xl font-semibold lg:text-2xl">{project.name}</h2>
            <p className="mt-1 text-sm text-muted">One project workspace coordinating {project.repos.length} repositories.</p>
          </div>
          <Link to="/compose" search={{ projectId: project.id, threadId: undefined }} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-glow px-4 text-xs font-bold uppercase tracking-widest text-void shadow-[var(--shadow-glow)]">
            <Plus className="size-4" /> New instruction
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle>Repositories</SectionTitle>
                <span className="text-[10px] font-mono text-muted">{project.repos.length} connected</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {project.repos.map((repo, index) => (
                  <div key={repo} className="rounded-xl border border-edge bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg border border-glow/25 bg-glow-soft text-glow"><GitBranch className="size-4" /></span>
                      <span className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-glow"><span className="size-1.5 rounded-full bg-glow" />Synced</span>
                    </div>
                    <div className="mt-4 truncate text-sm font-medium">{repo}</div>
                    <div className="mt-1 text-[9px] font-mono text-muted">main · {index === 0 ? "updated now" : `${index + 2}m ago`}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between"><SectionTitle>Threads</SectionTitle><span className="text-[10px] font-mono text-muted">{projectThreads.length} total</span></div>
              <div className="overflow-hidden rounded-xl border border-edge bg-surface">
                {projectThreads.length === 0 && <p className="p-5 text-sm text-muted">No threads yet. Send a task to start one.</p>}
                {projectThreads.map((t) => (
                  <Link key={t.id} to="/threads/$threadId" params={{ threadId: t.id }} className="group block border-b border-edge p-4 transition-colors last:border-b-0 hover:bg-glow-soft/50 lg:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.title}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {t.repoScope.map((repo) => <span key={repo} className="rounded border border-edge bg-void/60 px-2 py-1 text-[9px] font-mono text-muted">{repo}</span>)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2"><StatusDot status={t.status} /><StatusPill status={t.status} /></div>
                    </div>
                    <div className="mt-3 text-[9px] font-mono uppercase tracking-widest text-muted">{t.agent} · {t.model} · {t.updatedAt}</div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-edge bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><Settings2 className="size-4 text-muted" /><SectionTitle>Defaults</SectionTitle></div>
                {!editing ? <button onClick={() => setEditing(true)} className="text-[9px] font-mono uppercase tracking-widest text-muted hover:text-foreground">Edit</button> : <button onClick={save} className="text-[9px] font-mono uppercase tracking-widest text-glow">Save</button>}
              </div>
              <div className="space-y-4">
                <SettingRow label="Default agent" value={agent} options={AGENTS} editing={editing} onChange={(value) => { const next = value as AgentName; setAgent(next); setModel(MODELS_BY_AGENT[next][0]); }} />
                <SettingRow label="Default model" value={model} options={MODELS_BY_AGENT[agent]} editing={editing} onChange={setModel} />
              </div>
              <p className="mt-4 border-t border-edge pt-3 text-[9px] font-mono leading-relaxed text-muted">New threads inherit these settings unless the composer overrides them.</p>
            </section>

            <section className="rounded-xl border border-edge bg-surface/60 p-5">
              <div className="mb-3 flex items-center justify-between"><SectionTitle>Progress</SectionTitle><span className="text-xs font-mono">{project.paused ? "—" : `${project.progress}%`}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-edge"><div className="h-full bg-glow shadow-[var(--shadow-glow-soft)]" style={{ width: `${project.paused ? 0 : project.progress}%` }} /></div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="Active" value={String(projectThreads.filter((t) => t.status !== "done").length)} />
                <Stat label="Completed" value={String(projectThreads.filter((t) => t.status === "done").length)} />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-mono uppercase tracking-widest text-muted">{children}</h3>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-edge bg-void/60 p-3"><div className="text-[9px] font-mono uppercase tracking-widest text-muted">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>;
}

function SettingRow({ label, value, options, editing, onChange }: { label: string; value: string; options: readonly string[]; editing: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[9px] font-mono uppercase tracking-widest text-muted">{label}</span>
      {editing ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-edge bg-void px-3 text-xs font-mono focus:border-glow/60 focus:outline-none">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      ) : <div className="rounded-lg border border-edge bg-void/50 px-3 py-2.5 text-xs font-mono">{value}</div>}
    </label>
  );
}
