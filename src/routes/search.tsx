import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import {
  formatTime,
  getProjects,
  jobTitle,
  searchThreads,
  type Agent,
  type JobStatus,
  type Project,
  type ThreadSearchFilters,
  type ThreadSearchResponse,
} from "@/lib/api";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — Command Center" }] }),
  component: SearchPage,
});

const PAGE_SIZE = 20;

function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<JobStatus | "">("");
  const [agent, setAgent] = useState<Agent | "">("");
  const [repositoryId, setRepositoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filters: ThreadSearchFilters = useMemo(
    () => ({
      ...(debouncedQuery ? { query: debouncedQuery } : {}),
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
      ...(agent ? { agent } : {}),
      ...(repositoryId ? { repositoryId } : {}),
      ...(dateFrom ? { dateFrom: new Date(dateFrom).toISOString() } : {}),
      ...(dateTo ? { dateTo: new Date(dateTo + "T23:59:59Z").toISOString() } : {}),
      ...(includeArchived ? { includeArchived: true } : {}),
      page,
      pageSize: PAGE_SIZE,
    }),
    [
      debouncedQuery,
      projectId,
      status,
      agent,
      repositoryId,
      dateFrom,
      dateTo,
      includeArchived,
      page,
    ],
  );

  const hasActiveFilters = Boolean(
    projectId || status || agent || repositoryId || dateFrom || dateTo || includeArchived,
  );

  const searchQuery = useQuery<ThreadSearchResponse>({
    queryKey: ["thread-search", filters],
    queryFn: ({ signal }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const combinedSignal = signal ?? controller.signal;
      return searchThreads(filters, combinedSignal);
    },
    enabled: Boolean(debouncedQuery || hasActiveFilters),
    staleTime: 10_000,
  });

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const projectMap = useMemo(
    () => new Map((projectsQuery.data ?? []).map((p) => [p.id, p])),
    [projectsQuery.data],
  );

  const clearFilters = useCallback(() => {
    setProjectId("");
    setStatus("");
    setAgent("");
    setRepositoryId("");
    setDateFrom("");
    setDateTo("");
    setIncludeArchived(false);
    setPage(1);
  }, []);

  const clearAll = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    clearFilters();
  }, [clearFilters]);

  const allRepositories = useMemo(() => {
    const repos: Array<{ id: string; name: string; projectName: string }> = [];
    for (const project of projectsQuery.data ?? []) {
      for (const repo of project.repositories ?? []) {
        repos.push({ id: repo.id, name: repo.name, projectName: project.name });
      }
    }
    return repos;
  }, [projectsQuery.data]);

  const showResults = Boolean(debouncedQuery || hasActiveFilters);
  const results = searchQuery.data?.results ?? [];
  const total = searchQuery.data?.total ?? 0;
  const totalPages = searchQuery.data?.totalPages ?? 0;

  return (
    <AppShell title="Search">
      <div className="mx-auto w-full min-w-0 max-w-[1440px] px-3 py-5 min-[360px]:px-4 lg:px-8 lg:py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold lg:text-2xl">Thread search</h2>
          <p className="mt-1 text-sm text-muted">
            Search across all projects and conversation threads.
          </p>
        </div>

        <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search thread title, prompt, or response..."
              className="h-11 w-full rounded-lg border border-edge bg-surface pl-10 pr-10 text-sm placeholder:text-muted focus:border-glow/50 focus:outline-none"
              aria-label="Search threads"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setDebouncedQuery("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            className="h-11 gap-2 shrink-0"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            <Filter className="size-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="flex size-5 items-center justify-center rounded-full bg-glow text-[10px] font-bold text-void">
                !
              </span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="mb-4 rounded-xl border border-edge bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FilterSelect
                label="Project"
                value={projectId}
                onChange={(v) => {
                  setProjectId(v);
                  setRepositoryId("");
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All projects" },
                  ...(projectsQuery.data ?? []).map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <FilterSelect
                label="Status"
                value={status}
                onChange={(v) => {
                  setStatus(v as JobStatus | "");
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All statuses" },
                  { value: "queued", label: "Queued" },
                  { value: "running", label: "Running" },
                  { value: "needs_input", label: "Needs input" },
                  { value: "failed", label: "Failed" },
                  { value: "done", label: "Done" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
              <FilterSelect
                label="Agent"
                value={agent}
                onChange={(v) => {
                  setAgent(v as Agent | "");
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All agents" },
                  { value: "codex", label: "Codex" },
                  { value: "claude", label: "Claude" },
                  { value: "mock", label: "Mock" },
                ]}
              />
              <FilterSelect
                label="Repository"
                value={repositoryId}
                onChange={(v) => {
                  setRepositoryId(v);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All repositories" },
                  ...(projectId
                    ? allRepositories.filter((r) => {
                        const project = projectMap.get(projectId);
                        return project?.repositories?.some((pr) => pr.id === r.id);
                      })
                    : allRepositories
                  ).map((r) => ({ value: r.id, label: `${r.name} (${r.projectName})` })),
                ]}
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono uppercase tracking-wider text-muted">
                  From date
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-edge bg-void px-3 text-sm focus:border-glow/50 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono uppercase tracking-wider text-muted">
                  To date
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-edge bg-void px-3 text-sm focus:border-glow/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => {
                    setIncludeArchived(e.target.checked);
                    setPage(1);
                  }}
                  className="size-4 rounded border-edge accent-glow"
                />
                Include archived threads
              </label>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-mono text-muted hover:text-glow"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {!showResults && (
          <DataState title="Enter a search term or apply filters to find threads." />
        )}

        {showResults && searchQuery.isPending && <LoadingState label="Searching..." />}

        {showResults && searchQuery.isError && (
          <ErrorState error={searchQuery.error} retry={() => searchQuery.refetch()} />
        )}

        {showResults && searchQuery.isSuccess && results.length === 0 && (
          <div className="rounded-xl border border-dashed border-edge p-8 text-center">
            <p className="text-sm text-muted">No threads found matching your criteria.</p>
            <button onClick={clearAll} className="mt-3 text-xs font-mono text-glow hover:underline">
              Clear all filters
            </button>
          </div>
        )}

        {showResults && searchQuery.isSuccess && results.length > 0 && (
          <>
            <div className="mb-3 text-xs font-mono text-muted">
              {total} thread{total === 1 ? "" : "s"} found
            </div>
            <div className="space-y-3">
              {results.map((result) => (
                <SearchResultCard
                  key={result.threadId}
                  result={result}
                  project={projectMap.get(result.projectId)}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <nav
                className="mt-4 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
                aria-label="Search results pagination"
              >
                <Button
                  variant="outline"
                  className="h-11 gap-1 px-3"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <span className="text-center text-xs font-mono text-muted" aria-live="polite">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  className="h-11 gap-1 px-3"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="size-4" />
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function SearchResultCard({
  result,
  project,
}: {
  result: ThreadSearchResponse["results"][number];
  project?: Project;
}) {
  const repoNames = useMemo(() => {
    if (!project) return [];
    return result.repositoryIds
      .map((id) => project.repositories?.find((r) => r.id === id)?.name)
      .filter(Boolean) as string[];
  }, [project, result.repositoryIds]);

  const title = jobTitle({ prompt: result.title, id: result.threadId } as never);

  return (
    <div className="relative min-w-0 rounded-xl border border-edge bg-surface p-4 hover:border-glow/30">
      <Link
        to="/threads/$threadId"
        params={{ threadId: result.threadId }}
        className="absolute inset-0 rounded-xl"
        aria-label={`Open ${title}`}
      />
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="pointer-events-none min-w-0">
          <div className="mb-1 flex flex-wrap gap-x-2 text-xs font-mono uppercase leading-5 tracking-wider text-muted">
            <span>{project?.name ?? result.projectId}</span>
            <span>·</span>
            <span>
              {result.agent}
              {result.model ? `/${result.model}` : ""}
            </span>
            {result.archived && (
              <>
                <span>·</span>
                <span className="text-alert">Archived</span>
              </>
            )}
          </div>
          <div className="break-words text-base font-medium leading-6">{title}</div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono leading-5 text-muted">
            <span>{formatTime(result.updatedAt)}</span>
            <span>
              {result.runCount} {result.runCount === 1 ? "run" : "runs"}
            </span>
            {repoNames.length > 0 && <span>{repoNames.join(", ")}</span>}
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <StatusDot status={result.latestStatus} />
          <StatusPill status={result.latestStatus} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-mono uppercase tracking-wider text-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-edge bg-void px-3 text-sm focus:border-glow/50 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
