import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DataState, ErrorState, LoadingState } from "@/components/DataState";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { formatTime, getJobs, getProjects, jobTitle } from "@/lib/api";
export const Route = createFileRoute("/logs")({
  head: () => ({ meta: [{ title: "Logs — Command Center" }] }),
  component: LogsPage,
});
function LogsPage() {
  const [search, setSearch] = useState("");
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: getJobs, refetchInterval: 5000 });
  const projects = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const names = new Map((projects.data ?? []).map((p) => [p.id, p.name]));
  const filtered = (jobs.data ?? []).filter((j) =>
    `${jobTitle(j)} ${j.agent} ${j.status} ${names.get(j.projectId)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <AppShell title="Agent logs">
      <div className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted">
              Job_Stream
            </h2>
            <p className="mt-2 hidden text-sm text-muted lg:block">
              Current job activity across every project.
            </p>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-edge bg-surface px-3 lg:w-64">
            <Search className="size-3.5 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs"
              className="min-w-0 flex-1 bg-transparent text-xs focus:outline-none"
            />
          </label>
        </div>
        {jobs.isPending ? (
          <LoadingState />
        ) : jobs.isError ? (
          <ErrorState error={jobs.error} retry={() => jobs.refetch()} />
        ) : filtered.length === 0 ? (
          <DataState title={search ? "No jobs match your search." : "No job activity yet."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-edge bg-surface">
            {filtered.map((j) => (
              <Link
                key={j.id}
                to="/threads/$threadId"
                params={{ threadId: j.id }}
                className="block border-b border-edge px-4 py-4 last:border-0 hover:bg-glow-soft/40 lg:grid lg:grid-cols-[170px_180px_minmax(260px,1fr)_120px_110px] lg:gap-4"
              >
                <div className="text-[9px] font-mono text-glow">
                  {formatTime(j.updatedAt ?? j.createdAt)}
                </div>
                <div className="mt-1 truncate text-xs lg:mt-0">
                  {names.get(j.projectId) ?? j.projectId}
                </div>
                <div className="mt-2 truncate text-xs lg:mt-0">{jobTitle(j)}</div>
                <div className="mt-2 text-[9px] font-mono text-muted lg:mt-0">{j.agent}</div>
                <div className="mt-2 flex items-center gap-2 lg:mt-0">
                  <StatusDot status={j.status} />
                  <StatusPill status={j.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
