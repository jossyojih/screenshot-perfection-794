export type Agent = "mock" | "codex" | "claude";
export type JobStatus = "queued" | "running" | "needs_input" | "failed" | "cancelled" | "done";
export type ScopeMode = "auto" | "manual" | "all";
export interface ScopeReason {
  repositoryId: string;
  reason: string;
}
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
  scopeMode: ScopeMode;
  requestedRepositoryIds: string[];
  resolvedRepositoryIds: string[];
  scopeReasons: ScopeReason[];
  proposedRepositoryIds?: string[];
  parentJobId?: string;
  threadId?: string;
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
export interface LoginCredentials {
  password: string;
}

const configuredApi = import.meta.env.VITE_RUNNER_API_URL?.trim();
if (!configuredApi) throw new Error("VITE_RUNNER_API_URL is required");
const API = configuredApi.replace(/\/+$/, "");
let tokenAccessor: () => string | null = () => null;
let unauthorizedHandler = () => undefined;
export function setAuthAccessors(getToken: () => string | null, onUnauthorized: () => void) {
  tokenAccessor = getToken;
  unauthorizedHandler = onUnauthorized;
}
export function apiUrl(path: string) {
  return `${API}${path.startsWith("/") ? path : `/${path}`}`;
}
export function authorizationHeaders() {
  const token = tokenAccessor();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
export async function authenticatedFetch(path: string, init?: RequestInit) {
  const response = await fetch(apiUrl(path), {
    ...init,
    cache: "no-store",
    headers: { ...authorizationHeaders(), ...init?.headers },
  });
  if (response.status === 401) unauthorizedHandler();
  return response;
}

function arrayPayload<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object")
    for (const key of keys) {
      const nested = (value as Record<string, unknown>)[key];
      if (Array.isArray(nested)) return nested as T[];
    }
  return [];
}
function objectPayload<T>(value: unknown, keys: string[]): T {
  if (value && typeof value === "object")
    for (const key of keys) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested && typeof nested === "object") return nested as T;
    }
  return value as T;
}
async function responseError(response: Response) {
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    message = body.message ?? body.error ?? message;
  } catch {
    /* Non-JSON response. */
  }
  return new Error(message);
}

async function request<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  const response = authenticated
    ? await authenticatedFetch(path, {
        ...init,
        headers: {
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      })
    : await fetch(apiUrl(path), {
        ...init,
        cache: "no-store",
        headers: {
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      });
  if (response.status === 401 && authenticated) unauthorizedHandler();
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export async function loginRequest(credentials: LoginCredentials) {
  const body = await request<Record<string, unknown>>(
    "/auth/login",
    { method: "POST", body: JSON.stringify(credentials) },
    false,
  );
  const data = objectPayload<Record<string, unknown>>(body, ["data", "session"]);
  const accessToken = data.accessToken ?? data.access_token ?? data.token;
  const rawExpiry = data.expiresAt ?? data.expires_at;
  const expiresIn = data.expiresIn ?? data.expires_in;
  const expiresAt =
    typeof rawExpiry === "number"
      ? rawExpiry < 10_000_000_000
        ? rawExpiry * 1000
        : rawExpiry
      : typeof rawExpiry === "string"
        ? Date.parse(rawExpiry)
        : typeof expiresIn === "number"
          ? Date.now() + expiresIn * 1000
          : NaN;
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  )
    throw new Error("The runner returned an invalid session.");
  return { accessToken, expiresAt };
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
export async function getConversation(id: string) {
  return arrayPayload<Job>(await request<unknown>(`/jobs/${encodeURIComponent(id)}/conversation`), [
    "jobs",
    "conversation",
    "data",
  ]);
}
export async function createJob(
  input: Pick<Job, "projectId" | "prompt" | "scopeMode" | "requestedRepositoryIds" | "agent">,
) {
  return objectPayload<Job>(
    await request<unknown>("/jobs", { method: "POST", body: JSON.stringify(input) }),
    ["job", "data"],
  );
}
export async function decideJobScope(id: string, decision: "approve" | "reject") {
  return objectPayload<Job>(
    await request<unknown>(`/jobs/${encodeURIComponent(id)}/scope-decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
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
export async function continueJob(id: string, message: string, requestId: string) {
  return objectPayload<Job>(
    await request<unknown>(`/jobs/${encodeURIComponent(id)}/follow-ups`, {
      method: "POST",
      body: JSON.stringify({ message, requestId }),
    }),
    ["job", "data"],
  );
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
