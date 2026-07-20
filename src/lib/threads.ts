import type { Job, JobStatus } from "@/lib/api";

export type ConversationThread = {
  key: string;
  runs: Job[];
  initialRun: Job;
  latestRun: Job;
  runCount: number;
  agents: Job["agent"][];
  activityAt?: string;
};

const timestamp = (value?: string) => Date.parse(value ?? "") || 0;
export const jobActivityAt = (job: Job) => job.updatedAt ?? job.createdAt;

export function groupJobsByThread(jobs: Job[]): ConversationThread[] {
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const groups = new Map<string, Job[]>();

  const threadKey = (job: Job) => {
    if (job.threadId) return job.threadId;

    let current = job;
    const visited = new Set([job.id]);
    while (current.parentJobId && !visited.has(current.parentJobId)) {
      const parent = jobsById.get(current.parentJobId);
      if (!parent) return current.parentJobId;
      if (parent.threadId) return parent.threadId;
      visited.add(parent.id);
      current = parent;
    }
    return current.id;
  };

  for (const job of jobs) {
    const key = threadKey(job);
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }

  return [...groups.entries()]
    .map(([key, runs]) => {
      const orderedRuns = [...runs].sort(
        (a, b) => timestamp(a.createdAt ?? a.updatedAt) - timestamp(b.createdAt ?? b.updatedAt),
      );
      const latestRun = orderedRuns.at(-1)!;
      return {
        key,
        runs: orderedRuns,
        initialRun: orderedRuns[0],
        latestRun,
        runCount: runs.length,
        agents: [...new Set(runs.map((run) => run.agent))],
        activityAt: jobActivityAt(latestRun),
      };
    })
    .sort((a, b) => timestamp(b.activityAt) - timestamp(a.activityAt));
}

export const isRunningThread = (status: JobStatus) => status === "queued" || status === "running";
export const needsThreadAttention = (status: JobStatus) =>
  status === "needs_input" || status === "failed";
export const isCompletedThread = (status: JobStatus) => status === "done";
