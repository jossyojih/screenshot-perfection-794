export type Agent = "mock" | "codex" | "claude";
export type ReasoningLevel = "low" | "medium" | "high" | "xhigh" | "max";
export type JobStatus = "queued" | "running" | "needs_input" | "failed" | "cancelled" | "done";
export type ScopeMode = "auto" | "manual" | "all";
export type PromotionPolicy = "review_required" | "auto_push" | "read_only";
export interface ScopeReason {
  repositoryId: string;
  reason: string;
}
export interface ThreadRepositoryPermission {
  repositoryId: string;
  decision: "approved" | "rejected";
  inherited: boolean;
}
export interface Repository {
  id: string;
  name: string;
  url?: string;
  defaultBranch?: string;
  status?: string;
  promotionPolicyOverride?: PromotionPolicy;
  effectivePromotionPolicy?: PromotionPolicy;
}
export interface Project {
  id: string;
  name: string;
  description?: string;
  repositories: Repository[];
  createdAt?: string;
  updatedAt?: string;
  promotionPolicy?: PromotionPolicy;
  defaultAgent?: Agent;
  defaultModel?: string;
  defaultReasoningLevel?: ReasoningLevel;
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
  threadRepositoryPermissions?: ThreadRepositoryPermission[];
  parentJobId?: string;
  threadId?: string;
  agent: Agent;
  model: string;
  reasoningLevel?: ReasoningLevel;
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
export interface ArchivedThread {
  threadId: string;
  projectId: string;
  title: string;
  runCount: number;
  archivedAt: string;
  purgeAfter: string;
  latestStatus: JobStatus;
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
export type PromotionStatus = "pending" | "promoting" | "promoted" | "failed";
export interface ChangeFile {
  path: string;
  additions: number;
  deletions: number;
  diff: string;
  truncated: boolean;
}
export interface ChangeRepository {
  repositoryId: string;
  repositoryName: string;
  baseCommitSha: string;
  targetBranch: string;
  changedFiles: ChangeFile[];
  additions: number;
  deletions: number;
  hasChanges: boolean;
  effectivePromotionPolicy: PromotionPolicy;
}
export interface PromotionRepository {
  repositoryId: string;
  status: PromotionStatus;
  commitSha?: string;
  targetBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  error?: string;
  conflict?: boolean;
  updatedAt: string;
}
export interface Promotion {
  id: string;
  jobId: string;
  commitMessage: string;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
  repositories: PromotionRepository[];
}
export interface JobChanges {
  jobId: string;
  hasChanges: boolean;
  repositories: ChangeRepository[];
  promotion?: Promotion;
  limits: { totalDiffBytes: number; perFileDiffBytes: number };
}
export type DeploymentStatus = "queued" | "deploying" | "succeeded" | "failed" | "rolled_back";
export interface Deployment {
  id: string;
  jobId: string;
  promotionId: string;
  repositoryId: string;
  commitSha: string;
  status: DeploymentStatus;
  stage: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
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
export async function updateProjectPromotionPolicy(id: string, promotionPolicy: PromotionPolicy) {
  return request<Project>(`/projects/${encodeURIComponent(id)}/promotion-policy`, {
    method: "PUT",
    body: JSON.stringify({ promotionPolicy }),
  });
}
export async function updateRepositoryPromotionPolicy(
  id: string,
  repositoryId: string,
  promotionPolicyOverride: PromotionPolicy | null,
) {
  return request<Project>(
    `/projects/${encodeURIComponent(id)}/repositories/${encodeURIComponent(repositoryId)}/promotion-policy`,
    { method: "PUT", body: JSON.stringify({ promotionPolicyOverride }) },
  );
}
export async function getJobs() {
  return arrayPayload<Job>(await request<unknown>("/jobs"), ["jobs", "data"]);
}
export async function getArchivedThreads() {
  return arrayPayload<ArchivedThread>(await request<unknown>("/threads/archived"), [
    "threads",
    "data",
  ]);
}
export async function archiveThread(id: string, confirmActive: boolean) {
  return request<ArchivedThread>(`/threads/${encodeURIComponent(id)}/archive`, {
    method: "POST",
    body: JSON.stringify({ confirmActive }),
  });
}
export async function restoreThread(id: string) {
  return request<{ threadId: string }>(`/threads/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
}
export async function getRunnerHealth() {
  const response = await fetch(apiUrl("/health"), { cache: "no-store" });
  if (!response.ok) throw new Error(`Health check failed (${response.status})`);
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? ((await response.json()) as Record<string, unknown>)
    : { status: await response.text() };
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
  input: Pick<
    Job,
    | "projectId"
    | "prompt"
    | "scopeMode"
    | "requestedRepositoryIds"
    | "agent"
    | "model"
    | "reasoningLevel"
  >,
) {
  return objectPayload<Job>(
    await request<unknown>("/jobs", { method: "POST", body: JSON.stringify(input) }),
    ["job", "data"],
  );
}
export async function decideJobScope(
  id: string,
  decision: "approve" | "reject" | "choose",
  requestedRepositoryIds?: string[],
) {
  return objectPayload<Job>(
    await request<unknown>(`/jobs/${encodeURIComponent(id)}/scope-decision`, {
      method: "POST",
      body: JSON.stringify({ decision, requestedRepositoryIds }),
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
export async function continueJob(
  id: string,
  message: string,
  requestId: string,
  scope?: { scopeMode: "auto" | "manual"; requestedRepositoryIds?: string[] },
  selection?: { model?: string; reasoningLevel?: ReasoningLevel },
) {
  return objectPayload<Job>(
    await request<unknown>(`/jobs/${encodeURIComponent(id)}/continue`, {
      method: "POST",
      body: JSON.stringify({ message, requestId, ...scope, ...selection }),
    }),
    ["job", "data"],
  );
}
export async function getJobChanges(id: string) {
  return request<JobChanges>(`/jobs/${encodeURIComponent(id)}/changes`);
}
export async function promoteJob(
  id: string,
  commitMessage: string,
  approvedRepositoryIds: string[],
) {
  return request<Promotion>(`/jobs/${encodeURIComponent(id)}/promotions`, {
    method: "POST",
    body: JSON.stringify({ commitMessage, approvedRepositoryIds }),
  });
}
export async function getJobDeployments(id: string) {
  return arrayPayload<Deployment>(
    await request<unknown>(`/jobs/${encodeURIComponent(id)}/deployments`),
    ["deployments", "data"],
  );
}
export interface AgentCapability {
  id: Agent;
  models: string[];
  reasoningLevels: ReasoningLevel[];
  defaults: { model: string; reasoningLevel?: ReasoningLevel };
}
export interface Capabilities {
  agents: AgentCapability[];
  defaults: { agent: Agent };
}
export interface ThreadSearchFilters {
  query?: string;
  projectId?: string;
  status?: JobStatus;
  agent?: Agent;
  repositoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}
export interface ThreadSearchResult {
  threadId: string;
  projectId: string;
  title: string;
  latestStatus: JobStatus;
  agent: Agent;
  model: string;
  runCount: number;
  repositoryIds: string[];
  updatedAt: string;
  createdAt: string;
  archived: boolean;
}
export interface ThreadSearchResponse {
  results: ThreadSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export async function searchThreads(
  filters: ThreadSearchFilters,
  signal?: AbortSignal,
): Promise<ThreadSearchResponse> {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.status) params.set("status", filters.status);
  if (filters.agent) params.set("agent", filters.agent);
  if (filters.repositoryId) params.set("repositoryId", filters.repositoryId);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.includeArchived) params.set("includeArchived", "true");
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  const response = await authenticatedFetch(`/threads/search${qs ? `?${qs}` : ""}`, { signal });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<ThreadSearchResponse>;
}

export async function getCapabilities() {
  return request<Capabilities>("/capabilities");
}
export async function updateProjectAgentDefaults(
  id: string,
  input: { agent: Agent; model?: string; reasoningLevel?: ReasoningLevel },
) {
  return request<Project>(`/projects/${encodeURIComponent(id)}/agent-defaults`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
export const projectRepositories = (project: Project) => {
  const raw = project.repositories ?? (project as unknown as { repos?: unknown[] }).repos ?? [];
  return raw.map((repository) =>
    typeof repository === "string" ? { id: repository, name: repository } : repository,
  ) as Repository[];
};
export const jobTitle = (job: Job) => {
  const prompt = job.prompt
    ?.replace(/^\s*(?:[-*+]\s+|#+\s*|\d+[.)]\s+)/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!prompt) return `Job ${job.id}`;

  const sentence = prompt.match(/^.*?[.!?](?=\s|$)/)?.[0];
  if (sentence && sentence.length <= 72) return sentence.replace(/[.!?]+$/, "");

  const phrase = prompt.split(/\s*(?:[.!?;:]|\n)\s*/)[0] || prompt;
  if (phrase.length <= 72) return phrase;

  const words = phrase.split(" ");
  let title = words.shift() ?? "";
  while (words.length && `${title} ${words[0]}`.length <= 69) title += ` ${words.shift()}`;
  return `${title.replace(/[,\-–—]+$/, "")}…`;
};
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
