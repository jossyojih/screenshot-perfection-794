import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { HardDrive, Trash2, Clock, CheckCircle2, AlertCircle, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth";

export const Route = createFileRoute("/maintenance")({
  component: MaintenancePage,
});

interface MaintenanceStatus {
  lastRunAt?: string;
  lastRunCompletedAt?: string;
  isRunning: boolean;
  eligibleWorktrees: number;
  protectedWorktrees: number;
  lastCleanedCount: number;
  lastFailedCount: number;
  totalReclaimedBytes: number;
  retainedWorktreeCount: number;
  retainedWorktreeBytes?: number;
}

interface CleanupPreview {
  eligible: Array<{
    jobId: string;
    repositoryId: string;
    reason: string;
    estimatedBytes: number;
  }>;
  protectedWorktrees: Array<{
    jobId: string;
    repositoryId: string;
    reason: string;
  }>;
}

interface CleanupHistory {
  cleaned: Array<{
    jobId: string;
    repositoryId: string;
    worktreePath: string;
    reason: string;
    reclaimedBytes: number;
    cleanedAt: string;
  }>;
  failed: Array<{
    jobId: string;
    repositoryId: string;
    worktreePath: string;
    reason: string;
    errorCode: string;
    failedAt: string;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function MaintenancePage() {
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery<MaintenanceStatus>({
    queryKey: ["maintenance", "status"],
    queryFn: async () => {
      const response = await authFetch("/maintenance/status");
      if (!response.ok) throw new Error("Failed to fetch maintenance status");
      return response.json();
    },
    refetchInterval: 10000,
  });

  const { data: preview } = useQuery<CleanupPreview>({
    queryKey: ["maintenance", "preview"],
    queryFn: async () => {
      const response = await authFetch("/maintenance/preview");
      if (!response.ok) throw new Error("Failed to fetch cleanup preview");
      return response.json();
    },
    enabled: !status?.isRunning,
  });

  const { data: history } = useQuery<CleanupHistory>({
    queryKey: ["maintenance", "history"],
    queryFn: async () => {
      const response = await authFetch("/maintenance/history");
      if (!response.ok) throw new Error("Failed to fetch cleanup history");
      return response.json();
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await authFetch("/maintenance/cleanup", { method: "POST" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Cleanup failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Cleanup started", {
        description: "Maintenance cleanup is now running in the background.",
      });
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
    onError: (error: Error) => {
      toast.error("Cleanup failed", {
        description: error.message,
      });
    },
  });

  if (statusLoading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-4 sm:py-8 px-4 sm:px-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Storage & Maintenance</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Monitor disk usage and manage worktree cleanup
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Retained Worktrees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.retainedWorktreeCount ?? 0}</div>
            {status?.retainedWorktreeBytes !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatBytes(status.retainedWorktreeBytes)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Eligible for Cleanup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.eligibleWorktrees ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {preview?.eligible.length ?? 0} in preview
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Last Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.lastCleanedCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {status?.lastRunCompletedAt ? formatRelativeTime(status.lastRunCompletedAt) : "Never"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Total Reclaimed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(status?.totalReclaimedBytes ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 mb-6 sm:mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Cleanup Preview
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={status?.isRunning || cleanupMutation.isPending}>
                    {status?.isRunning || cleanupMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Running
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Run Cleanup
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Cleanup</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove {preview?.eligible.length ?? 0} eligible
                      worktrees. {preview?.protectedWorktrees.length ?? 0} protected worktrees with
                      pending changes will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => cleanupMutation.mutate()}>
                      Run Cleanup
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardTitle>
            <CardDescription>Worktrees that can be safely removed</CardDescription>
          </CardHeader>
          <CardContent>
            {preview && preview.eligible.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {preview.eligible.slice(0, 10).map((item) => (
                  <div
                    key={`${item.jobId}-${item.repositoryId}`}
                    className="flex items-start justify-between gap-2 p-2 border rounded text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs truncate">{item.jobId.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">{item.reason}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {formatBytes(item.estimatedBytes)}
                    </Badge>
                  </div>
                ))}
                {preview.eligible.length > 10 && (
                  <div className="text-xs text-center text-muted-foreground py-2">
                    + {preview.eligible.length - 10} more
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No worktrees eligible for cleanup
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Protected Worktrees</CardTitle>
            <CardDescription>Worktrees that will be kept</CardDescription>
          </CardHeader>
          <CardContent>
            {preview && preview.protectedWorktrees.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {preview.protectedWorktrees.slice(0, 10).map((item) => (
                  <div
                    key={`${item.jobId}-${item.repositoryId}`}
                    className="flex items-start justify-between gap-2 p-2 border rounded text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs truncate">{item.jobId.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">{item.reason}</div>
                    </div>
                  </div>
                ))}
                {preview.protectedWorktrees.length > 10 && (
                  <div className="text-xs text-center text-muted-foreground py-2">
                    + {preview.protectedWorktrees.length - 10} more
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No protected worktrees
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {history && (history.cleaned.length > 0 || history.failed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest cleanup operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.cleaned.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{item.jobId.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{item.reason}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {formatBytes(item.reclaimedBytes)}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(item.cleanedAt)}
                  </div>
                </div>
              ))}
              {history.failed.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{item.jobId.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{item.errorCode}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(item.failedAt)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
