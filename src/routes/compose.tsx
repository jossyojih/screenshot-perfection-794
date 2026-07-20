import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, GitBranch, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { createJob, getProjects, projectRepositories, type Agent } from "@/lib/api";
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
  const [projectId, setProjectId] = useState(search.projectId ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [agent, setAgent] = useState<Agent>("codex");
  const project = projects.data?.find((p) => p.id === projectId) ?? projects.data?.[0];
  const selectedProjectId = project?.id;
  const repos = project ? projectRepositories(project) : [];
  useEffect(() => {
    if (!projectId && projects.data?.[0]) setProjectId(projects.data[0].id);
  }, [projectId, projects.data]);
  useEffect(() => {
    const selectedProject = projects.data?.find((item) => item.id === selectedProjectId);
    if (selectedProject) setSelected(projectRepositories(selectedProject).map((r) => r.id));
  }, [projects.data, selectedProjectId]);
  const mutation = useMutation({
    mutationFn: createJob,
    onSuccess: (job) => navigate({ to: "/threads/$threadId", params: { threadId: job.id } }),
  });
  const dispatch = () =>
    project &&
    mutation.mutate({
      projectId: project.id,
      prompt: prompt.trim(),
      selectedRepositoryIds: selected,
      agent,
    });
  if (projects.isPending)
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
                {project?.name ?? "No project"} · {selected.length} repositories
              </div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-widest text-muted">
                {agent}
              </div>
            </div>
            <button
              onClick={dispatch}
              disabled={!project || !prompt.trim() || selected.length === 0 || mutation.isPending}
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
                <div className="mb-3 flex justify-between">
                  <Title noMargin>Repository_Scope</Title>
                  <button
                    onClick={() => setSelected(repos.map((r) => r.id))}
                    className="text-[9px] font-mono uppercase text-muted"
                  >
                    Select all
                  </button>
                </div>
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
              </section>
              <section>
                <Title>Agent</Title>
                <div className="grid grid-cols-2 gap-2">
                  {(["codex", "claude"] as Agent[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAgent(a)}
                      className={`rounded-lg border p-4 text-left text-xs font-mono uppercase ${agent === a ? "border-glow/60 bg-glow-soft text-glow" : "border-edge bg-surface"}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
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
