import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
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
import { disconnectRepository, errorMessage, type Repository } from "@/lib/api";

interface Props {
  projectId: string;
  repository: Repository;
}

function repoConfirmName(repo: Repository): string {
  if (repo.url) {
    return repo.url.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
  }
  return repo.name;
}

export function DisconnectRepositoryDialog({ projectId, repository }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const queryClient = useQueryClient();
  const expectedName = repoConfirmName(repository);

  const mutation = useMutation({
    mutationFn: () => disconnectRepository(projectId, repository.id, expectedName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const canConfirm =
    confirmation.trim() === expectedName && !mutation.isPending && !mutation.isSuccess;

  const handleClose = (value: boolean) => {
    if (mutation.isPending) return;
    setOpen(value);
    if (!value) {
      setConfirmation("");
      mutation.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
          Disconnect
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect repository</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">This will remove the repository from this project.</p>
              <p className="mt-1 text-muted-foreground">
                The remote GitHub repository will not be deleted or modified. Historical threads and
                audit records are preserved.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Repository:{" "}
              <span className="font-mono font-medium text-foreground">{expectedName}</span>
            </p>
            {repository.url && (
              <p className="text-xs text-muted-foreground">
                URL: <span className="font-mono">{repository.url}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-disconnect">
              Type <span className="font-mono font-bold">{expectedName}</span> to confirm
            </Label>
            <Input
              id="confirm-disconnect"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={expectedName}
              disabled={mutation.isPending || mutation.isSuccess}
              onPaste={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </div>

          {mutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {errorMessage(mutation.error)}
            </div>
          )}

          {mutation.isSuccess && (
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-600 dark:text-green-400">
              Repository disconnected successfully.
            </div>
          )}

          <div className="flex justify-end gap-2">
            {mutation.isSuccess ? (
              <Button type="button" onClick={() => handleClose(false)}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!canConfirm}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Disconnect
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
