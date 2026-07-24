import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, GitBranch, Send, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AttachmentUpload } from "@/components/AttachmentUpload";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import {
  createJob,
  getCapabilities,
  getProjects,
  projectRepositories,
  type Agent,
  type AttachmentMetadata,
  type ReasoningLevel,
  type ScopeMode,
} from "@/lib/api";
export const Route = createFileRoute("/compose")({
  validateSearch: (s: Record<string, unknown>) => ({
    projectId: typeof s.projectId === "string" ? s.projectId : undefined,
    threadId: typeof s.threadId === "string" ? s.threadId : undefined,
  }),
  head: () => ({ meta: [{ title: "Send Task — Command Center" }] }),
  component: ComposePage,
});
function ComposePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const projects = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: getCapabilities });
  const [projectId, setProjectId] = useState(search.projectId ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("auto");
  const [prompt, setPrompt] = useState("");
  const [agent, setAgent] = useState<Agent | undefined>(undefined);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel | undefined>(undefined);
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>([]);
  const project = projects.data?.find((p) => p.id === projectId) ?? projects.data?.[0];
  const selectedProjectId = project?.id;
  const repos = project ? projectRepositories(project) : [];
  const agentCapability = capabilities.data?.agents.find((a) => a.id === agent);
  const effectiveAgent =
    agent ?? project?.defaultAgent ?? capabilities.data?.defaults.agent ?? "codex";
  const effectiveCapability =
    capabilities.data?.agents.find((a) => a.id === effectiveAgent) ?? capabilities.data?.agents[0];
  const effectiveModel =
    model ??
    (agent === project?.defaultAgent ? project?.defaultModel : undefined) ??
    effectiveCapability?.defaults.model ??
    "";
  const effectiveReasoning =
    reasoningLevel ??
    (agent === project?.defaultAgent ? project?.defaultReasoningLevel : undefined) ??
    effectiveCapability?.defaults.reasoningLevel;
  useEffect(() => {
    if (!projectId && projects.data?.[0]) setProjectId(projects.data[0].id);
  }, [projectId, projects.data]);
  useEffect(() => {
    const selectedProject = projects.data?.find((item) => item.id === selectedProjectId);
    if (selectedProject) setSelected([]);
  }, [projects.data, selectedProjectId]);
  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: (job) => navigate({ to: "/threads/$threadId", params: { threadId: job.id } }),
  });
  const dispatch = () => {
    if (!project || !effectiveAgent) return;
    mutation.mutate({
      projectId: project.id,
      prompt: prompt.trim(),
      scopeMode,
      requestedRepositoryIds: scopeMode === "manual" ? selected : [],
      agent: effectiveAgent,
      model: effectiveModel,
      reasoningLevel: effectiveReasoning,
      attachments: attachments.length ? attachments : undefined,
    });
  };
  if (projects.isPending || capabilities.isPending)
    return (
      <AppShell title="New instruction">
        <Page>
          <LoadingState />
        </Page>
      </AppShell>
    );
  if (projects.isError)
    return (
      <AppShell title="New instruction">
        <Page>
          <ErrorState error={projects.error} retry={() => projects.refetch()} />
        </Page>
      </AppShell>
    );
  if (capabilities.isError)
    return (
      <AppShell title="New instruction">
        <Page>
          <ErrorState error={capabilities.error} retry={() => capabilities.refetch()} />
        </Page>
      </AppShell>
    );
  return (
    <AppShell
      title="New instruction"
      headerRight={
        <Link to="/" className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Cancel
        </Link>
      }
      bottomBar={
        <div className="border-t border-edge bg-surface/90 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1440px] items-center gap-4">
            <div className="hidden flex-1 lg:block">
              <div className="text-xs font-medium">
                {project?.name ?? "No project"} ·{" "}
                {scopeMode === "auto"
                  ? "automatic scope"
                  : scopeMode === "all"
                    ? `${repos.length} repositories`
                    : `${selected.length} selected`}
              </div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-widest text-muted">
                {effectiveAgent} · {effectiveModel}
                {effectiveReasoning && ` · ${effectiveReasoning}`}
              </div>
            </div>
            <button
              onClick={dispatch}
              disabled={
                !project ||
                !prompt.trim() ||
                (scopeMode === "manual" && selected.length === 0) ||
                mutation.isPending
              }
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-glow px-6 font-mono text-xs font-bold uppercase tracking-widest text-void disabled:bg-edge disabled:text-muted lg:w-auto lg:min-w-56 lg:rounded-lg"
            >
              <Send className="size-4" />
              {mutation.isPending ? "Dispatching…" : "Dispatch task"}
            </button>
          </div>
        </div>
      }
    >
      <Page>
        <div className="mb-6 hidden lg:block">
          <h2 className="text-xl font-semibold">Compose an agent task</h2>
          <p className="mt-1 text-sm text-muted">
            Choose the project, repository scope, and runtime before dispatch.
          </p>
        </div>
        {projects.data.length === 0 ? (
          <DataState title="Create a project before dispatching a job." />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside>
              <Title>Project</Title>
              <div className="space-y-2">
                {projects.data.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProjectId(p.id)}
                    className={`w-full rounded-lg border p-3 text-left ${p.id === project?.id ? "border-glow/60 bg-glow-soft" : "border-edge bg-surface"}`}
                  >
                    <div className="text-xs font-medium">{p.name}</div>
                    <div className="mt-1 text-[9px] font-mono text-muted">
                      {projectRepositories(p).length} repositories
                    </div>
                  </button>
                ))}
              </div>
            </aside>
            <div className="space-y-6">
              <section>
                <Title>Repository_Scope</Title>
                <div className="mb-4 grid gap-2 md:grid-cols-3">
                  {(
                    [
                      [
                        "auto",
                        "Auto-select",
                        "Recommended · plans once and uses the minimum repositories",
                      ],
                      [
                        "manual",
                        "Manual selection",
                        "Only repositories you explicitly grant are writable",
                      ],
                      ["all", "All repositories", "Explicitly grant every repository for this job"],
                    ] as const
                  ).map(([mode, label, description]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setScopeMode(mode)}
                      className={`rounded-lg border p-4 text-left ${scopeMode === mode ? "border-glow/60 bg-glow-soft" : "border-edge bg-surface"}`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium">
                        {mode === "auto" && <Sparkles className="size-4 text-glow" />}
                        {label}
                      </div>
                      <p className="mt-2 text-[10px] leading-relaxed text-muted">{description}</p>
                    </button>
                  ))}
                </div>
                {scopeMode === "all" && (
                  <div className="mb-4 flex gap-3 rounded-lg border border-alert/40 bg-alert-soft p-3 text-xs text-alert">
                    <TriangleAlert className="size-4 shrink-0" />
                    <span>
                      All repositories increases context usage, execution time, and cost. Choose
                      this only when the task truly spans the whole project.
                    </span>
                  </div>
                )}
                {scopeMode === "auto" && (
                  <div className="rounded-lg border border-edge bg-surface p-4 text-xs text-muted">
                    The runner performs one bounded, read-only planning pass, records why each
                    repository is needed, then grants write access only to that resolved scope.
                  </div>
                )}
                {scopeMode === "manual" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {repos.map((r) => {
                      const active = selected.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          onClick={() =>
                            setSelected((v) =>
                              active
                                ? v.length === 1
                                  ? v
                                  : v.filter((id) => id !== r.id)
                                : [...v, r.id],
                            )
                          }
                          className={`flex items-center gap-3 rounded-lg border p-3 text-left ${active ? "border-glow/60 bg-glow-soft" : "border-edge bg-surface opacity-65"}`}
                        >
                          <GitBranch className="size-4 text-glow" />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {r.name}
                            <span className="mt-1 block truncate text-[9px] font-normal text-muted">
                              {repositoryDescription(r.name)}
                            </span>
                          </span>
                          <span
                            className={`flex size-5 items-center justify-center rounded border ${active ? "border-glow bg-glow text-void" : "border-edge text-transparent"}`}
                          >
                            <Check className="size-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {repos.length === 0 && <DataState title="This project has no repositories." />}
              </section>
              <section>
                <Title>Instruction</Title>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={10}
                  placeholder="Describe the outcome you want the agent to achieve…"
                  className="w-full resize-none rounded-xl border border-edge bg-surface p-4 text-sm leading-relaxed focus:border-glow/50 focus:outline-none"
                />
                <div className="mt-3">
                  <AttachmentUpload
                    onAttachmentsChange={setAttachments}
                    disabled={mutation.isPending}
                  />
                </div>
              </section>
              <section>
                <Title>Agent and Model</Title>
                {capabilities.data ? (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted">
                        Agent
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {capabilities.data.agents.map((a) => {
                          const isSelected = agent === a.id;
                          const isDefault = !agent && a.id === effectiveAgent;
                          return (
                            <button
                              key={a.id}
                              onClick={() => {
                                setAgent(a.id);
                                setModel(undefined);
                                setReasoningLevel(undefined);
                              }}
                              className={`rounded-lg border p-3 text-left text-xs font-mono uppercase ${
                                isSelected
                                  ? "border-glow/60 bg-glow-soft text-glow"
                                  : isDefault
                                    ? "border-glow/30 bg-glow-soft/50"
                                    : "border-edge bg-surface"
                              }`}
                            >
                              {a.id}
                              {isDefault && !isSelected && (
                                <span className="ml-1 text-[8px] text-muted">(default)</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {effectiveCapability && effectiveCapability.models.length > 1 && (
                      <div>
                        <label className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted">
                          {effectiveAgent === "claude" ? "Claude Model" : "Model"}
                        </label>
                        <select
                          value={model ?? ""}
                          onChange={(e) => setModel(e.target.value || undefined)}
                          className="w-full rounded-lg border border-edge bg-surface p-3 text-xs font-mono"
                        >
                          <option value="">Default ({effectiveCapability.defaults.model})</option>
                          {effectiveCapability.models.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {effectiveCapability &&
                      effectiveCapability.reasoningLevels.length > 0 &&
                      effectiveAgent === "codex" && (
                        <div>
                          <label className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted">
                            Reasoning Level
                          </label>
                          <select
                            value={reasoningLevel ?? ""}
                            onChange={(e) =>
                              setReasoningLevel(
                                (e.target.value || undefined) as ReasoningLevel | undefined,
                              )
                            }
                            className="w-full rounded-lg border border-edge bg-surface p-3 text-xs font-mono"
                          >
                            <option value="">
                              Default ({effectiveCapability.defaults.reasoningLevel})
                            </option>
                            {effectiveCapability.reasoningLevels.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                  </div>
                ) : (
                  <LoadingState />
                )}
              </section>
              {mutation.isError && <ErrorState error={mutation.error} />}
            </div>
          </div>
        )}
      </Page>
    </AppShell>
  );
}
const Page = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">{children}</div>
);
const repositoryDescription = (name: string) =>
  /front|client|web|ui/i.test(name)
    ? "Frontend / client repository"
    : /back|server|api/i.test(name)
      ? "Backend / API repository"
      : "Project repository";
const Title = ({
  children,
  noMargin = false,
}: {
  children: React.ReactNode;
  noMargin?: boolean;
}) => (
  <h2
    className={`text-[11px] font-mono uppercase tracking-widest text-muted ${noMargin ? "" : "mb-3"}`}
  >
    {children}
  </h2>
);
