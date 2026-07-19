export type ThreadStatus = "running" | "needs_input" | "failed" | "done";

export type AgentName = "Codex" | "Claude Code" | "Gemini CLI";
export const AGENTS: AgentName[] = ["Codex", "Claude Code", "Gemini CLI"];

export const MODELS_BY_AGENT: Record<AgentName, string[]> = {
  Codex: ["GPT-5.1", "GPT-5.1 Mini", "o4-Reasoning"],
  "Claude Code": ["Sonnet 5", "Opus 4.8", "Haiku 4"],
  "Gemini CLI": ["Fable 5", "Fable 5 Flash", "Gemini 3 Pro"],
};

export interface Project {
  id: string;
  name: string;
  repos: string[];
  progress: number; // 0-100
  paused?: boolean;
  defaultAgent: AgentName;
  defaultModel: string;
}

export interface ContextFile {
  repo: string;
  path: string;
}

export interface Thread {
  id: string;
  projectId: string;
  repoScope: string[];
  title: string;
  status: ThreadStatus;
  updatedAt: string;
  agent: AgentName;
  model?: string;
  // For running:
  currentAction?: string;
  tags?: string[];
  // For needs_input:
  question?: string;
  // For failed:
  failureKind?: "rate_limit" | "crash";
  failureMessage?: string;
  // For done:
  summary?: string;
  stats?: string;
}

export interface TimelineEntry {
  id: string;
  kind: "agent" | "user" | "system" | "question" | "summary" | "error";
  timestamp: string;
  text: string;
  bullets?: string[];
}

export const projects: Project[] = [
  {
    id: "onyx",
    name: "Project_Onyx",
    repos: ["onyx-web", "onyx-api", "onyx-docs"],
    progress: 84,
    defaultAgent: "Claude Code",
    defaultModel: "Sonnet 5",
  },
  {
    id: "hyper",
    name: "Hyper_Drive",
    repos: ["hyper-mono"],
    progress: 0,
    paused: true,
    defaultAgent: "Codex",
    defaultModel: "GPT-5.1",
  },
  {
    id: "atlas",
    name: "Atlas_Ledger",
    repos: ["atlas-core"],
    progress: 42,
    defaultAgent: "Gemini CLI",
    defaultModel: "Fable 5",
  },
];

export const threads: Thread[] = [
  {
    id: "t-auth",
    projectId: "onyx",
    repoScope: ["onyx-web", "onyx-api"],
    title: "Clarify Auth.ts controller logic",
    status: "needs_input",
    updatedAt: "2m ago",
    agent: "Claude Code",
    model: "Sonnet 5",
    question:
      "The session handler in Auth.ts can either invalidate all tokens on password change, or only the current session. Which behavior do you want?",
  },
  {
    id: "t-db",
    projectId: "onyx",
    repoScope: ["onyx-api", "onyx-docs"],
    title: "Refactor DB schema for multitenancy",
    status: "running",
    updatedAt: "just now",
    agent: "Codex",
    model: "GPT-5.1",
    currentAction: "$ generating migration_v2.sql...",
    tags: ["PostgreSQL", "Prisma"],
  },
  {
    id: "t-payments",
    projectId: "atlas",
    repoScope: ["atlas-core"],
    title: "Wire Stripe webhooks to ledger",
    status: "failed",
    updatedAt: "4m ago",
    agent: "Gemini CLI",
    model: "Fable 5",
    failureKind: "rate_limit",
    failureMessage:
      "Rate limit hit on model Fable 5 — 3 retries exhausted. Agent halted mid-task.",
  },
  {
    id: "t-ci",
    projectId: "atlas",
    repoScope: ["atlas-core"],
    title: "Fix broken unit tests in CI pipeline",
    status: "done",
    updatedAt: "1h ago",
    agent: "Codex",
    model: "GPT-5.1",
    summary: "Rewrote flaky ledger tests, isolated fixtures.",
    stats: "14 files modified · 2 tests passed",
  },
  {
    id: "t-hostel",
    projectId: "hyper",
    repoScope: ["hyper-mono"],
    title: "Hostel Management Feature — scaffolding",
    status: "done",
    updatedAt: "yesterday",
    agent: "Claude Code",
    model: "Sonnet 5",
    summary: "Scaffolded models, routes, and admin form.",
    stats: "6 files created · lint clean",
  },
];

export const contextFiles: Record<string, ContextFile[]> = {
  onyx: [
    { repo: "onyx-docs", path: "README.md" },
    { repo: "onyx-docs", path: "ARCHITECTURE.md" },
    { repo: "onyx-docs", path: "plans/multitenancy.md" },
    { repo: "onyx-docs", path: "plans/auth-v2.md" },
  ],
  hyper: [
    { repo: "hyper-mono", path: "README.md" },
    { repo: "hyper-mono", path: "plans/hostel-feature.md" },
  ],
  atlas: [
    { repo: "atlas-core", path: "README.md" },
    { repo: "atlas-core", path: "CONTRIBUTING.md" },
    { repo: "atlas-core", path: "plans/ledger-refactor.md" },
  ],
};

export const timeline: Record<string, TimelineEntry[]> = {
  "t-auth": [
    { id: "e1", kind: "user", timestamp: "14:02", text: "Rework Auth.ts so password changes invalidate stale sessions." },
    { id: "e2", kind: "agent", timestamp: "14:03", text: "Read src/lib/auth.ts. Identified two candidate strategies." },
    { id: "e3", kind: "question", timestamp: "14:06", text: "Invalidate all tokens on password change, or only the current session?" },
  ],
  "t-db": [
    { id: "e1", kind: "user", timestamp: "13:40", text: "Migrate the schema to tenant-scoped tables." },
    { id: "e2", kind: "agent", timestamp: "13:41", text: "Read schema.prisma, drafted migration_v2.sql." },
    { id: "e3", kind: "agent", timestamp: "13:44", text: "$ generating migration_v2.sql..." },
  ],
  "t-payments": [
    { id: "e1", kind: "user", timestamp: "15:20", text: "Wire the Stripe webhook into the ledger reconciliation job." },
    { id: "e2", kind: "agent", timestamp: "15:21", text: "Read stripe/webhooks.ts, ledger/reconcile.ts. Drafted handler." },
    { id: "e3", kind: "agent", timestamp: "15:24", text: "$ retrying model call (attempt 2/3)..." },
    { id: "e4", kind: "error", timestamp: "15:26", text: "429 Rate limit exceeded on Fable 5. Agent halted." },
  ],
  "t-ci": [
    { id: "e1", kind: "user", timestamp: "12:10", text: "Fix the CI pipeline — ledger tests keep flaking." },
    {
      id: "e2",
      kind: "summary",
      timestamp: "12:58",
      text: "Rewrote flaky ledger tests, isolated fixtures.",
      bullets: [
        "Replaced shared DB fixture with per-test transaction",
        "Removed 3 dead assertions",
        "CI green on last 5 runs",
      ],
    },
  ],
  "t-hostel": [
    { id: "e1", kind: "user", timestamp: "yesterday", text: "Scaffold the hostel management feature end-to-end." },
    {
      id: "e2",
      kind: "summary",
      timestamp: "yesterday",
      text: "Scaffolded models, routes, and admin form.",
      bullets: ["Added Hostel + Room models", "Wired /admin/hostels route", "Basic form validation"],
    },
  ],
};

export const projectById = (id: string) => projects.find((p) => p.id === id);
export const threadById = (id: string) => threads.find((t) => t.id === id);

// Mutable prototype helpers
export function updateProjectDefaults(id: string, agent: AgentName, model: string) {
  const p = projectById(id);
  if (p) {
    p.defaultAgent = agent;
    p.defaultModel = model;
  }
}

export function handoffThread(threadId: string, agent: AgentName, model: string) {
  const t = threadById(threadId);
  if (t) {
    t.agent = agent;
    t.model = model;
    t.status = "running";
    t.currentAction = `$ handed off to ${agent} (${model}), resuming...`;
    t.updatedAt = "just now";
  }
}
