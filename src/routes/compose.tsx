import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  AGENTS,
  MODELS_BY_AGENT,
  contextFiles,
  projectById,
  projects,
  threads,
} from "@/lib/mock-data";
import type { AgentName } from "@/lib/mock-data";

export const Route = createFileRoute("/compose")({
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
  const [projectId, setProjectId] = useState(projects[0].id);
  const [threadId, setThreadId] = useState<string>("new");
  const [instruction, setInstruction] = useState("");
  const [attached, setAttached] = useState<string[]>([]);

  const project = projectById(projectId);

  const [agent, setAgent] = useState<AgentName>(project?.defaultAgent ?? "Codex");
  const [model, setModel] = useState<string>(project?.defaultModel ?? "GPT-5.1");

  // Re-sync when project changes
  useEffect(() => {
    if (!project) return;
    setAgent(project.defaultAgent);
    setModel(project.defaultModel);
  }, [projectId, project]);

  const projectThreads = useMemo(
    () => threads.filter((t) => t.projectId === projectId),
    [projectId],
  );
  const files = contextFiles[projectId] ?? [];

  const toggleFile = (f: string) => {
    setAttached((a) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]));
  };

  const dispatch = () => {
    const target = projectThreads.find((t) => t.status === "running") ?? projectThreads[0];
    if (target) navigate({ to: "/threads/$threadId", params: { threadId: target.id } });
    else navigate({ to: "/" });
  };

  const overriding =
    project && (agent !== project.defaultAgent || model !== project.defaultModel);

  return (
    <AppShell
      title="Send_Task"
      headerRight={
        <Link
          to="/"
          className="text-[10px] font-mono text-muted uppercase tracking-widest hover:text-foreground"
        >
          Cancel
        </Link>
      }
      bottomBar={
        <div className="p-4 border-t border-edge bg-surface/80 backdrop-blur-md">
          <button
            onClick={dispatch}
            disabled={instruction.trim().length === 0}
            className="w-full h-12 rounded-full bg-glow text-void font-mono text-xs font-bold tracking-widest uppercase shadow-[var(--shadow-glow)] disabled:bg-edge disabled:text-muted disabled:shadow-none transition-all"
          >
            Dispatch to {project?.name}
          </button>
        </div>
      }
    >
      <div className="px-4 py-4 space-y-6">
        {/* Project */}
        <section>
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest mb-2">
            Project
          </h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {projects.map((p) => {
              const active = p.id === projectId;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setProjectId(p.id);
                    setThreadId("new");
                    setAttached([]);
                  }}
                  className={`shrink-0 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    active
                      ? "border-glow/60 bg-glow-soft text-foreground"
                      : "border-edge bg-surface text-muted"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Thread */}
        <section>
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest mb-2">
            Thread
          </h2>
          <div className="space-y-2">
            <button
              onClick={() => setThreadId("new")}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                threadId === "new"
                  ? "border-glow/60 bg-glow-soft"
                  : "border-edge bg-surface hover:border-edge"
              }`}
            >
              <div className="text-xs font-medium">+ New thread</div>
              <div className="text-[10px] text-muted font-mono mt-0.5">
                Start a fresh line of work in {project?.name}
              </div>
            </button>
            {projectThreads.map((t) => {
              const active = t.id === threadId;
              return (
                <button
                  key={t.id}
                  onClick={() => setThreadId(t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    active
                      ? "border-glow/60 bg-glow-soft"
                      : "border-edge bg-surface hover:border-edge"
                  }`}
                >
                  <div className="text-xs font-medium">{t.title}</div>
                  <div className="text-[10px] text-muted font-mono mt-0.5 uppercase tracking-widest">
                    {t.status.replace("_", " ")} · {t.updatedAt}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Agent + Model */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest">
              Runtime
            </h2>
            {overriding && (
              <span className="text-[10px] font-mono text-alert uppercase tracking-widest">
                Overriding default
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="p-3 rounded-lg border border-edge bg-surface">
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">
                Agent
              </div>
              <select
                value={agent}
                onChange={(e) => {
                  const next = e.target.value as AgentName;
                  setAgent(next);
                  setModel(MODELS_BY_AGENT[next][0]);
                }}
                className="w-full bg-transparent text-xs font-mono focus:outline-none"
              >
                {AGENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="p-3 rounded-lg border border-edge bg-surface">
              <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">
                Model
              </div>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-transparent text-xs font-mono focus:outline-none"
              >
                {MODELS_BY_AGENT[agent].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[10px] text-muted font-mono mt-2">
            Default: {project?.defaultAgent} · {project?.defaultModel}
          </p>
        </section>

        {/* Instruction */}
        <section>
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest mb-2">
            Instruction
          </h2>
          <div className="rounded-lg border border-edge bg-surface focus-within:border-glow/40 transition-colors">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Describe the change. e.g. 'Add per-room availability to the hostel model and expose it in /admin/hostels.'"
              rows={5}
              className="w-full bg-transparent p-3 text-sm resize-none focus:outline-none placeholder:text-muted/60"
            />
            <div className="flex items-center justify-between px-3 py-2 border-t border-edge">
              <button
                type="button"
                className="flex items-center gap-2 text-[11px] text-muted hover:text-foreground font-mono uppercase tracking-widest"
              >
                <MicIcon />
                Dictate
              </button>
              <span className="text-[10px] text-muted font-mono">{instruction.length} chars</span>
            </div>
          </div>
        </section>

        {/* Context */}
        <section>
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest mb-2">
            Attach_Context
          </h2>
          <div className="flex flex-wrap gap-2">
            {files.map((f) => {
              const active = attached.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggleFile(f)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-mono transition-colors ${
                    active
                      ? "border-glow bg-glow-soft text-glow"
                      : "border-edge bg-surface text-muted hover:text-foreground"
                  }`}
                >
                  {active ? "✓ " : "+ "}
                  {f}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
