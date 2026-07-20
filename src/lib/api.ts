export type Agent = "codex" | "claude";
export type JobStatus = "queued" | "running" | "needs_input" | "failed" | "cancelled" | "done";

export interface Repository {
  id: string;
  name: string;
  url?: string;
  defaultBranch?: string;
  status?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  repositories: Repository[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RepositoryResult {
  repositoryId?: string;
  repositoryName?: string;
  status?: string;
  summary?: string;
  error?: string;
  [key: string]: unknown;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  [key: string]: unknown;
}

export interface Job {
  id: string;
  projectId: string;
  prompt: string;
  selectedRepositoryIds: string[];
  agent: Agent;
  status: JobStatus;
  createdAt?: string;
  updatedAt?: string;
  finalResponse?: string;
  error?: string | { message?: string; [key: string]: unknown };
  usage?: Usage;
  repositoryResults?: RepositoryResult[];
  question?: string;
  [key: string]: unknown;
}

export interface JobEvent {
  id?: string;
  type?: string;
  event?: string;
  message?: string;
  data?: unknown;
  timestamp?: string;
  createdAt?: string;
  [key: string]: unknown;
}

const API = "/api/runner";

function arrayPayload<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    for (const key of keys) {
      const nested = (value as Record<string, unknown>)[key];
      if (Array.isArray(nested)) return nested as T[];
    }
  }
  return [];
}

function objectPayload<T>(value: unknown, keys: string[]): T {
  if (value && typeof value === "object") {
    for (const key of keys) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested && typeof nested === "object") return nested as T;
    }
  }
  return value as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      /* upstream did not return JSON */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getProjects() {
  return arrayPayload<Project>(await request<unknown>("/projects"), ["projects", "data"]);
}
export async function getProject(id: string) {
  return objectPayload<Project>(await request<unknown>(`/projects/${encodeURIComponent(id)}`), [
    "project",
    "data",
  ]);
}
export async function getJobs() {
  return arrayPayload<Job>(await request<unknown>("/jobs"), ["jobs", "data"]);
}
export async function getJob(id: string) {
  return objectPayload<Job>(await request<unknown>(`/jobs/${encodeURIComponent(id)}`), [
    "job",
    "data",
  ]);
}
export async function createJob(
  input: Pick<Job, "projectId" | "prompt" | "selectedRepositoryIds" | "agent">,
) {
  return objectPayload<Job>(
    await request<unknown>("/jobs", { method: "POST", body: JSON.stringify(input) }),
    ["job", "data"],
  );
}
export async function cancelJob(id: string) {
  return request<unknown>(`/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}
export async function replyToJob(id: string, message: string) {
  return request<unknown>(`/jobs/${encodeURIComponent(id)}/reply`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export const projectRepositories = (project: Project) => {
  const raw = project.repositories ?? (project as unknown as { repos?: unknown[] }).repos ?? [];
  return raw.map((repository) =>
    typeof repository === "string" ? { id: repository, name: repository } : repository,
  ) as Repository[];
};
export const jobTitle = (job: Job) => job.prompt?.split("\n")[0]?.slice(0, 100) || `Job ${job.id}`;
export const statusLabel = (status: JobStatus) => status.replace("_", " ").toUpperCase();
export const formatTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
