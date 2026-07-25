import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject, errorMessage, getGitHubStatus, type GitHubRepository, type PromotionPolicy } from "@/lib/api";
import { GitHubRepositoryPicker } from "@/components/GitHubRepositoryPicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GITHUB_URL_PATTERN =
  /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?|git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?)$/;

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promotionPolicy, setPromotionPolicy] = useState<PromotionPolicy>("review_required");
  const [repoUrls, setRepoUrls] = useState<Array<{ url: string; name: string }>>([]);
  const [githubRepos, setGithubRepos] = useState<Array<{ owner: string; repo: string; name?: string; defaultBranch: string }>>([]);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [urlError, setUrlError] = useState("");
  const [repoSource, setRepoSource] = useState<"url" | "github">("url");
  const queryClient = useQueryClient();

  const { data: githubStatus } = useQuery({
    queryKey: ["github-status"],
    queryFn: getGitHubStatus,
    retry: false,
  });

  useEffect(() => {
    if (open && githubStatus?.configured && repoSource === "url") {
      setRepoSource("github");
    }
  }, [open, githubStatus?.configured, repoSource]);

  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        promotionPolicy,
        repositoryUrls: repoUrls.length > 0 ? repoUrls : undefined,
        githubRepositories: githubRepos.length > 0 ? githubRepos : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      resetForm();
      setOpen(false);
    },
  });

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setPromotionPolicy("review_required");
    setRepoUrls([]);
    setGithubRepos([]);
    setNewUrl("");
    setNewName("");
    setUrlError("");
    setRepoSource(githubStatus?.configured ? "github" : "url");
    mutation.reset();
  }, [mutation, githubStatus?.configured]);

  const addRepoUrl = () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    if (!GITHUB_URL_PATTERN.test(trimmed)) {
      setUrlError("Enter a valid github.com HTTPS or SSH URL");
      return;
    }
    if (/\/\/[^@/]*:[^@/]*@/.test(trimmed)) {
      setUrlError("Do not include credentials in the URL");
      return;
    }
    if (repoUrls.some((r) => r.url === trimmed)) {
      setUrlError("This URL is already added");
      return;
    }
    setRepoUrls([...repoUrls, { url: trimmed, name: newName.trim() || "" }]);
    setNewUrl("");
    setNewName("");
    setUrlError("");
  };

  const removeRepo = (index: number) => {
    setRepoUrls(repoUrls.filter((_, i) => i !== index));
  };

  const handleGitHubSelect = (repo: GitHubRepository) => {
    setGithubRepos([...githubRepos, { owner: repo.owner, repo: repo.name, defaultBranch: repo.defaultBranch }]);
  };

  const handleGitHubDeselect = (owner: string, repo: string) => {
    setGithubRepos(githubRepos.filter((r) => !(r.owner === owner && r.repo === repo)));
  };

  const removeGitHubRepo = (owner: string, repo: string) => {
    setGithubRepos(githubRepos.filter((r) => !(r.owner === owner && r.repo === repo)));
  };

  const canSubmit = name.trim().length > 0 && !mutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Create project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My project"
              maxLength={200}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description (optional)</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              maxLength={1000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-policy">Promotion policy</Label>
            <Select
              value={promotionPolicy}
              onValueChange={(v) => setPromotionPolicy(v as PromotionPolicy)}
            >
              <SelectTrigger id="project-policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="review_required">Review & Push</SelectItem>
                <SelectItem value="auto_push">Auto-push</SelectItem>
                <SelectItem value="read_only">Read-only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Repositories (optional)</Label>
            <Tabs value={repoSource} onValueChange={(v) => setRepoSource(v as "url" | "github")}>
              {githubStatus?.configured && (
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="github">Choose from GitHub</TabsTrigger>
                  <TabsTrigger value="url">Enter URL</TabsTrigger>
                </TabsList>
              )}

              <TabsContent value="github" className="mt-3">
                {githubRepos.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {githubRepos.map((repo, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md border border-edge bg-void/50 px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">{repo.owner}/{repo.repo}</span>
                        <span className="shrink-0 text-muted">{repo.defaultBranch}</span>
                        <button
                          type="button"
                          onClick={() => removeGitHubRepo(repo.owner, repo.repo)}
                          className="shrink-0 text-muted hover:text-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <GitHubRepositoryPicker
                  selectedRepositories={githubRepos}
                  onSelect={handleGitHubSelect}
                  onDeselect={handleGitHubDeselect}
                />
              </TabsContent>

              <TabsContent value="url" className="mt-3">
                {repoUrls.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {repoUrls.map((repo, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md border border-edge bg-void/50 px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">{repo.url}</span>
                        {repo.name && <span className="shrink-0 text-muted">({repo.name})</span>}
                        <button
                          type="button"
                          onClick={() => removeRepo(i)}
                          className="shrink-0 text-muted hover:text-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newUrl}
                    onChange={(e) => {
                      setNewUrl(e.target.value);
                      setUrlError("");
                    }}
                    placeholder="https://github.com/owner/repo"
                    className="flex-1 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addRepoUrl();
                      }
                    }}
                  />
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name (optional)"
                    className="w-full text-xs sm:w-32"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addRepoUrl}>
                    Add
                  </Button>
                </div>
                {urlError && <p className="text-xs text-destructive">{urlError}</p>}
              </TabsContent>
            </Tabs>
          </div>

          {mutation.isError && (
            <p className="text-xs text-destructive">{errorMessage(mutation.error)}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
