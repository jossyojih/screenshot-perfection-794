import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addRepository, errorMessage, getGitHubStatus, type GitHubRepository } from "@/lib/api";
import { GitHubRepositoryPicker } from "@/components/GitHubRepositoryPicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GITHUB_URL_PATTERN =
  /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?|git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?)$/;

interface Props {
  projectId: string;
}

export function AddRepositoryDialog({ projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [urlError, setUrlError] = useState("");
  const [repoSource, setRepoSource] = useState<"url" | "github">("url");
  const [selectedGithubRepo, setSelectedGithubRepo] = useState<{
    owner: string;
    repo: string;
    defaultBranch: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: githubStatus, isLoading: isLoadingGitHubStatus } = useQuery({
    queryKey: ["github-status"],
    queryFn: getGitHubStatus,
    retry: false,
    staleTime: 60000,
  });

  useEffect(() => {
    if (open && githubStatus?.configured) {
      setRepoSource("github");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (selectedGithubRepo) {
        return addRepository(projectId, {
          owner: selectedGithubRepo.owner,
          repo: selectedGithubRepo.repo,
          defaultBranch: selectedGithubRepo.defaultBranch,
          name: name.trim() || undefined,
        });
      }
      return addRepository(projectId, { url: url.trim(), name: name.trim() || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const resetForm = useCallback(() => {
    setUrl("");
    setName("");
    setUrlError("");
    setSelectedGithubRepo(null);
    setRepoSource(githubStatus?.configured ? "github" : "url");
    mutation.reset();
  }, [mutation, githubStatus?.configured]);

  const validate = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError("Repository URL is required");
      return false;
    }
    if (!GITHUB_URL_PATTERN.test(trimmed)) {
      setUrlError("Enter a valid github.com HTTPS or SSH URL");
      return false;
    }
    if (/\/\/[^@/]*:[^@/]*@/.test(trimmed)) {
      setUrlError("Do not include credentials in the URL");
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (selectedGithubRepo || (repoSource === "url" && validate())) {
      mutation.mutate();
    }
  };

  const handleGitHubSelect = (repo: GitHubRepository) => {
    setSelectedGithubRepo({
      owner: repo.owner,
      repo: repo.name,
      defaultBranch: repo.defaultBranch,
    });
  };

  const handleGitHubDeselect = () => {
    setSelectedGithubRepo(null);
  };

  const canSubmit =
    ((repoSource === "url" && url.trim().length > 0) ||
      (repoSource === "github" && selectedGithubRepo)) &&
    !mutation.isPending &&
    !mutation.isSuccess;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-4" />
          Add repository
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add repository</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {isLoadingGitHubStatus ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted">
              <Loader2 className="size-4 animate-spin" />
              Checking GitHub configuration...
            </div>
          ) : (
            <Tabs value={repoSource} onValueChange={(v) => setRepoSource(v as "url" | "github")}>
              {githubStatus?.configured && (
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="github">Choose from GitHub</TabsTrigger>
                  <TabsTrigger value="url">Enter URL</TabsTrigger>
                </TabsList>
              )}

              {githubStatus?.configured && (
                <TabsContent value="github" className="mt-3 space-y-3">
                  <GitHubRepositoryPicker
                    projectId={projectId}
                    selectedRepositories={selectedGithubRepo ? [selectedGithubRepo] : []}
                    onSelect={handleGitHubSelect}
                    onDeselect={handleGitHubDeselect}
                  />
                </TabsContent>
              )}

              <TabsContent value="url" className="mt-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="repo-url">GitHub repository URL</Label>
                  <Input
                    id="repo-url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setUrlError("");
                    }}
                    placeholder="https://github.com/owner/repo"
                    disabled={mutation.isPending || mutation.isSuccess}
                    autoFocus={repoSource === "url"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                  {urlError && <p className="text-xs text-destructive">{urlError}</p>}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <div className="space-y-2">
            <Label htmlFor="repo-name">Display name (optional)</Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Inferred if blank"
              maxLength={200}
              disabled={mutation.isPending || mutation.isSuccess}
            />
          </div>

          {mutation.isPending && (
            <div className="flex items-center gap-2 rounded-md border border-edge bg-void/50 p-3 text-xs">
              <Loader2 className="size-4 animate-spin text-muted" />
              <span>Cloning and validating repository...</span>
            </div>
          )}
          {mutation.isSuccess && (
            <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              <span>Repository connected successfully</span>
            </div>
          )}
          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <XCircle className="size-4" />
              <span>{errorMessage(mutation.error)}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {mutation.isError && (
              <Button type="button" variant="outline" size="sm" onClick={() => mutation.mutate()}>
                <RotateCcw className="mr-1.5 size-3.5" />
                Retry
              </Button>
            )}
            {mutation.isSuccess ? (
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
                  {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Add
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
