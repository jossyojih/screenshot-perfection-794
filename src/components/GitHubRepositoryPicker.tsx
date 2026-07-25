import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, AlertCircle, Lock, Globe, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getGitHubRepositories, type GitHubRepository } from "@/lib/api";

interface Props {
  projectId?: string;
  selectedRepositories: Array<{ owner: string; repo: string; defaultBranch: string }>;
  onSelect: (repo: GitHubRepository) => void;
  onDeselect: (owner: string, repo: string) => void;
}

export function GitHubRepositoryPicker({
  projectId,
  selectedRepositories,
  onSelect,
  onDeselect,
}: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["github-repositories", page, debouncedSearch, projectId],
    queryFn: () => getGitHubRepositories({ page, perPage: 30, search: debouncedSearch, projectId }),
    retry: false,
  });

  const isSelected = (owner: string, repo: string) =>
    selectedRepositories.some((r) => r.owner === owner && r.repo === repo);

  const handleToggle = (repo: GitHubRepository) => {
    if (isSelected(repo.owner, repo.name)) {
      onDeselect(repo.owner, repo.name);
    } else {
      onSelect(repo);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search repositories..."
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted">
          <Loader2 className="size-4 animate-spin" />
          Loading repositories...
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error instanceof Error ? error.message : "Failed to load repositories"}</span>
        </div>
      )}

      {!isLoading && !isError && data && data.repositories.length === 0 && (
        <div className="py-8 text-center text-xs text-muted">
          {debouncedSearch ? "No repositories match your search" : "No repositories available"}
        </div>
      )}

      {!isLoading && !isError && data && data.repositories.length > 0 && (
        <>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {data.repositories.map((repo) => {
              const selected = isSelected(repo.owner, repo.name);
              const disabled = repo.alreadyConnected && !selected;

              return (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => !disabled && handleToggle(repo)}
                  disabled={disabled}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : disabled
                        ? "border-edge bg-void/30 opacity-50"
                        : "border-edge bg-void/50 hover:border-primary/50 hover:bg-void"
                  }`}
                >
                  <div className="flex size-5 shrink-0 items-center justify-center">
                    {selected ? (
                      <CheckCircle2 className="size-5 text-primary" />
                    ) : (
                      <div className="size-4 rounded border border-edge" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-xs font-medium">
                        {repo.fullName}
                      </span>
                      {repo.private ? (
                        <Lock className="size-3 shrink-0 text-muted" />
                      ) : (
                        <Globe className="size-3 shrink-0 text-muted" />
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {repo.private ? "Private" : "Public"} · {repo.defaultBranch}
                    </div>
                  </div>

                  {disabled && (
                    <span className="shrink-0 text-xs text-muted">Already connected</span>
                  )}
                </button>
              );
            })}
          </div>

          {data.totalCount > data.perPage && (
            <div className="flex items-center justify-between border-t border-edge pt-3 text-xs text-muted">
              <span>
                Page {page} of {Math.ceil(data.totalCount / data.perPage)}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(data.totalCount / data.perPage)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
