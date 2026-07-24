import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Loader2, CheckCircle2, XCircle } from "lucide-react";
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
import { updateProject, errorMessage, type Project } from "@/lib/api";

interface Props {
  project: Project;
}

export function EditProjectDialog({ project }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
  }, [open, project.name, project.description]);

  const mutation = useMutation({
    mutationFn: () =>
      updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData(["project", project.id], updatedProject);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const resetForm = useCallback(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setNameError("");
    mutation.reset();
  }, [project.name, project.description, mutation]);

  const validate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Project name is required");
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  };

  const canSubmit = name.trim().length > 0 && !mutation.isPending && !mutation.isSuccess;
  const hasChanges =
    name.trim() !== project.name || (description.trim() || undefined) !== project.description;

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
          <Edit className="size-4" />
          Edit project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-project-name">Project name</Label>
            <Input
              id="edit-project-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
              }}
              placeholder="My project"
              maxLength={200}
              required
              autoFocus
              disabled={mutation.isPending || mutation.isSuccess}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-project-description">Description (optional)</Label>
            <Input
              id="edit-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              maxLength={1000}
              disabled={mutation.isPending || mutation.isSuccess}
            />
          </div>

          {mutation.isPending && (
            <div className="flex items-center gap-2 rounded-md border border-edge bg-void/50 p-3 text-xs">
              <Loader2 className="size-4 animate-spin text-muted" />
              <span>Saving changes...</span>
            </div>
          )}
          {mutation.isSuccess && (
            <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              <span>Project updated successfully</span>
            </div>
          )}
          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <XCircle className="size-4" />
              <span>{errorMessage(mutation.error)}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
                <Button type="submit" disabled={!canSubmit || !hasChanges}>
                  {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
