import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { addRepository, errorMessage } from "@/lib/api";

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
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => addRepository(projectId, { url: url.trim(), name: name.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const resetForm = useCallback(() => {
    setUrl("");
    setName("");
    setUrlError("");
    mutation.reset();
  }, [mutation]);

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
    if (!validate()) return;
    mutation.mutate();
  };

  const canSubmit = url.trim().length > 0 && !mutation.isPending && !mutation.isSuccess;

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add repository</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="repo-name">Display name (optional)</Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Inferred from URL if blank"
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
