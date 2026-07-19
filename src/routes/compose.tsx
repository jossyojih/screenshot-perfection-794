import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, GitBranch, Mic, Paperclip, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { threadStatusLabel } from "@/components/StatusPill";
import { AGENTS, MODELS_BY_AGENT, contextFiles, projectById, projects, threads } from "@/lib/mock-data";
import type { AgentName } from "@/lib/mock-data";

export const Route = createFileRoute("/compose")({
  validateSearch: (search: Record<string, unknown>) => ({
    projectId: typeof search.projectId === "string" ? search.projectId : undefined,
    threadId: typeof search.threadId === "string" ? search.threadId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Send Task — Command Center" },
      { name: "description", content: "Compose a new instruction for a remote coding agent." },
    ],
  }),
  component: ComposePage,
});

function ComposePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const initialProjectId = search.projectId && projectById(search.projectId) ? search.projectId : projects[0].id;
  const initialProject = projectById(initialProjectId)!;
  const initialThread = threads.find((t) => t.id === search.threadId && t.projectId === initialProjectId);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [threadId, setThreadId] = useState<string>(initialThread?.id ?? "new");
  const [repoScope, setRepoScope] = useState<string[]>(initialThread?.repoScope ?? initialProject.repos);
  const [instruction, setInstruction] = useState("");
  const [attached, setAttached] = useState<string[]>([]);
  const project = projectById(projectId)!;
  const [agent, setAgent] = useState<AgentName>(project.defaultAgent);
  const [model, setModel] = useState(project.defaultModel);

  useEffect(() => {
    setAgent(project.defaultAgent);
    setModel(project.defaultModel);
  }, [project]);

  const projectThreads = useMemo(() => threads.filter((t) => t.projectId === projectId), [projectId]);
  const files = (contextFiles[projectId] ?? []).filter((f) => repoScope.includes(f.repo));
  const overriding = agent !== project.defaultAgent || model !== project.defaultModel;

  const chooseProject = (id: string) => {
    const next = projectById(id)!;
    setProjectId(id);
    setThreadId("new");
    setRepoScope(next.repos);
    setAttached([]);
  };

  const chooseThread = (id: string) => {
    setThreadId(id);
    const selected = projectThreads.find((t) => t.id === id);
    if (selected) setRepoScope(selected.repoScope);
  };

  const toggleRepo = (repo: string) => {
    setRepoScope((current) => {
      if (current.includes(repo)) {
        if (current.length === 1) return current;
        setAttached((items) => items.filter((item) => !item.startsWith(`${repo}:`)));
        return current.filter((item) => item !== repo);
      }
      return [...current, repo];
    });
  };

  const toggleFile = (key: string) => setAttached((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const dispatch = () => {
    const target = threadId !== "new" ? projectThreads.find((t) => t.id === threadId) : projectThreads.find((t) => t.status === "running") ?? projectThreads[0];
    navigate(target ? { to: "/threads/$threadId", params: { threadId: target.id } } : { to: "/" });
  };

  return (
    <AppShell
      title="New instruction"
      headerRight={<Link to="/" className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-foreground">Cancel</Link>}
      bottomBar={
        <div className="border-t border-edge bg-surface/90 px-4 py-3 backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center gap-4">
            <div className="hidden min-w-0 flex-1 lg:block">
              <div className="truncate text-xs font-medium">{project.name} · {repoScope.length} repo{repoScope.length === 1 ? "" : "s"}</div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-widest text-muted">{agent} · {model} · {attached.length} files attached</div>
            </div>
            <button onClick={dispatch} disabled={!instruction.trim()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-glow px-6 font-mono text-xs font-bold uppercase tracking-widest text-void shadow-[var(--shadow-glow)] disabled:bg-edge disabled:text-muted disabled:shadow-none lg:w-auto lg:min-w-56 lg:rounded-lg">
              <Send className="size-4" /> Dispatch task
            </button>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">
        <div className="mb-6 hidden lg:block">
          <h2 className="text-xl font-semibold">Compose an agent task</h2>
          <p className="mt-1 text-sm text-muted">Choose the project, repository scope, and runtime before dispatch.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="space-y-6">
            <section>
              <SectionTitle>Project</SectionTitle>
              <div className="space-y-2">
                {projects.map((p) => (
                  <button key={p.id} onClick={() => chooseProject(p.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${p.id === projectId ? "border-glow/60 bg-glow-soft" : "border-edge bg-surface hover:border-glow/30"}`}>
                    <div className="text-xs font-medium">{p.name}</div>
                    <div className="mt-1 text-[9px] font-mono text-muted">{p.repos.length} repo{p.repos.length === 1 ? "" : "s"}</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle>Thread</SectionTitle>
              <div className="space-y-2">
                <button onClick={() => { setThreadId("new"); setRepoScope(project.repos); }} className={`w-full rounded-lg border p-3 text-left ${threadId === "new" ? "border-glow/60 bg-glow-soft" : "border-edge bg-surface"}`}>
                  <div className="text-xs font-medium">+ New thread</div>
                  <div className="mt-1 text-[9px] font-mono text-muted">Fresh line of work</div>
                </button>
                {projectThreads.map((t) => (
                  <button key={t.id} onClick={() => chooseThread(t.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${threadId === t.id ? "border-glow/60 bg-glow-soft" : "border-edge bg-surface hover:border-glow/30"}`}>
                    <div className="line-clamp-2 text-xs font-medium">{t.title}</div>
                    <div className="mt-1.5 text-[9px] font-mono uppercase tracking-widest text-muted">{threadStatusLabel[t.status]} · {t.repoScope.length} repo{t.repoScope.length === 1 ? "" : "s"}</div>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle noMargin>Repository_Scope</SectionTitle>
                <button onClick={() => setRepoScope(project.repos)} className="text-[9px] font-mono uppercase tracking-widest text-muted hover:text-glow">Select all</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                {project.repos.map((repo) => {
                  const active = repoScope.includes(repo);
                  return (
                    <button key={repo} onClick={() => toggleRepo(repo)} className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${active ? "border-glow/60 bg-glow-soft" : "border-edge bg-surface opacity-65"}`}>
                      <span className={`flex size-8 items-center justify-center rounded-md border ${active ? "border-glow/50 bg-glow-soft text-glow" : "border-edge bg-void text-muted"}`}><GitBranch className="size-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{repo}</span><span className="mt-1 block text-[9px] font-mono text-muted">main · synced</span></span>
                      <span className={`flex size-5 items-center justify-center rounded border ${active ? "border-glow bg-glow text-void" : "border-edge text-transparent"}`}><Check className="size-3" /></span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] font-mono text-muted">The agent can change only the selected repositories in this thread.</p>
            </section>

            <section>
              <SectionTitle>Instruction</SectionTitle>
              <div className="rounded-xl border border-edge bg-surface transition-colors focus-within:border-glow/50">
                <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Describe the outcome you want the agent to achieve..." rows={9} className="w-full resize-none bg-transparent p-4 text-sm leading-relaxed placeholder:text-muted/60 focus:outline-none" />
                <div className="flex items-center justify-between border-t border-edge px-4 py-3">
                  <button className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted hover:text-foreground"><Mic className="size-3.5" /> Dictate</button>
                  <span className="text-[10px] font-mono text-muted">{instruction.length} chars</span>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between"><SectionTitle noMargin>Runtime</SectionTitle>{overriding && <span className="text-[9px] font-mono uppercase tracking-widest text-alert">Overriding default</span>}</div>
              <div className={`grid grid-cols-2 gap-2 rounded-xl border p-2 ${overriding ? "border-alert/50 bg-alert-soft" : "border-edge bg-surface/50"}`}>
                <RuntimeSelect label="Agent" value={agent} options={AGENTS} onChange={(value) => { const next = value as AgentName; setAgent(next); setModel(MODELS_BY_AGENT[next][0]); }} />
                <RuntimeSelect label="Model" value={model} options={MODELS_BY_AGENT[agent]} onChange={setModel} />
              </div>
            </section>
          </div>

          <aside>
            <section className="xl:sticky xl:top-24">
              <div className="mb-3 flex items-center justify-between"><SectionTitle noMargin>Attach_Context</SectionTitle><span className="text-[9px] font-mono text-muted">{attached.length} selected</span></div>
              <div className="rounded-xl border border-edge bg-surface/50 p-3">
                <div className="mb-3 flex items-center gap-2 text-[10px] text-muted"><Paperclip className="size-3.5" /> Committed files in selected repos</div>
                <div className="space-y-2">
                  {files.length === 0 && <div className="rounded-lg border border-dashed border-edge p-4 text-center text-[10px] text-muted">No context files in this scope.</div>}
                  {files.map((f) => {
                    const key = `${f.repo}:${f.path}`;
                    const active = attached.includes(key);
                    return (
                      <button key={key} onClick={() => toggleFile(key)} className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${active ? "border-glow/60 bg-glow-soft" : "border-edge bg-void/60 hover:border-glow/30"}`}>
                        <span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-mono uppercase tracking-widest text-muted">{f.repo}</span><span className="mt-1 block truncate text-[11px] font-mono">{f.path}</span></span>
                        <span className={`flex size-5 items-center justify-center rounded border ${active ? "border-glow bg-glow text-void" : "border-edge text-muted"}`}>{active ? <Check className="size-3" /> : "+"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function SectionTitle({ children, noMargin = false }: { children: ReactNode; noMargin?: boolean }) {
  return <h2 className={`text-[11px] font-mono uppercase tracking-widest text-muted ${noMargin ? "" : "mb-3"}`}>{children}</h2>;
}

function RuntimeSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="rounded-lg border border-edge bg-surface p-3">
      <span className="mb-1 block text-[9px] font-mono uppercase tracking-widest text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-xs font-mono focus:outline-none">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
