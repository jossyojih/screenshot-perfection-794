import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { archiveThread, errorMessage } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ArchiveThreadButton({
  threadId,
  active = false,
  onArchived,
}: {
  threadId: string;
  active?: boolean;
  onArchived?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: () => archiveThread(threadId, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["archived-threads"] });
      setOpen(false);
      onArchived?.();
    },
  });
  return (
    <div className="shrink-0">
      <AlertDialog open={open} onOpenChange={(value) => !mutation.isPending && setOpen(value)}>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={mutation.isPending}
            className="flex h-9 items-center gap-1.5 rounded-md border border-edge px-2.5 text-[10px] font-mono uppercase text-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
          >
            {mutation.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Archive className="size-3.5" />
            )}{" "}
            Archive
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              Every linked run will disappear from normal views. You can restore it for 7 days,
              after which its retained data is permanently purged.
              {active ? " Active execution will be cancelled first." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutation.isError && (
            <p role="alert" className="text-sm text-danger">
              {errorMessage(mutation.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Keep thread</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {mutation.isPending
                ? "Archiving…"
                : active
                  ? "Cancel execution and archive"
                  : "Archive thread"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
