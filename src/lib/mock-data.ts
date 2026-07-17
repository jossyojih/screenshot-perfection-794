export type ThreadStatus = "running" | "needs_input" | "done";

export interface Project {
  id: string;
  name: string;
  repos: string[];
  progress: number; // 0-100
  paused?: boolean;
}

export interface Thread {
  id: string;
  projectId: string;
  title: string;
  status: ThreadStatus;
  updatedAt: string;
  agent: "Codex" | "Claude Code";
  // For running:
  currentAction?: string;
  tags?: string[];
  // For needs_input:
  question?: string;
  // For done:
  summary?: string;
  stats?: string;
}

export interface TimelineEntry {
  id: string;
  kind: "agent" | "user" | "system" | "question" | "summary";
  timestamp: string;
  text: string;
  bullets?: string[];
}

export const projects: Project[] = [
  { id: "onyx", name: "Project_Onyx", repos: ["onyx-web", "onyx-api"], progress: 84 },
  { id: "hyper", name: "Hyper_Drive", repos: ["hyper-mono"], progress: 0, paused: true },
  { id: "atlas", name: "Atlas_Ledger", repos: ["atlas-core"], progress: 42 },
];

export const threads: Thread[] = [
  {
    id: "t-auth",
    projectId: "onyx",
    title: "Clarify Auth.ts controller logic",
    status: "needs_input",
    updatedAt: "2m ago",
    agent: "Claude Code",
    question:
      "The session handler in Auth.ts can either invalidate all tokens on password change, or only the current session. Which behavior do you want?",
  },
  {
    id: "t-db",
    projectId: "onyx",
    title: "Refactor DB schema for multitenancy",
    status: "running",
    updatedAt: "just now",
    agent: "Codex",
    currentAction: "$ generating migration_v2.sql...",
    tags: ["PostgreSQL", "Prisma"],
  },
  {
    id: "t-ci",
    projectId: "atlas",
    title: "Fix broken unit tests in CI pipeline",
    status: "done",
    updatedAt: "1h ago",
    agent: "Codex",
    summary: "Rewrote flaky ledger tests, isolated fixtures.",
    stats: "14 files modified · 2 tests passed",
  },
  {
    id: "t-hostel",
    projectId: "hyper",
    title: "Hostel Management Feature — scaffolding",
    status: "done",
    updatedAt: "yesterday",
    agent: "Claude Code",
    summary: "Scaffolded models, routes, and admin form.",
    stats: "6 files created · lint clean",
  },
];

export const contextFiles: Record<string, string[]> = {
  onyx: ["README.md", "ARCHITECTURE.md", "plans/multitenancy.md", "plans/auth-v2.md"],
  hyper: ["README.md", "plans/hostel-feature.md"],
  atlas: ["README.md", "CONTRIBUTING.md", "plans/ledger-refactor.md"],
};

export const timeline: Record<string, TimelineEntry[]> = {
  "t-auth": [
    {
      id: "e1",
      kind: "user",
      timestamp: "14:02",
      text: "Rework Auth.ts so password changes invalidate stale sessions.",
    },
    {
      id: "e2",
      kind: "agent",
      timestamp: "14:03",
      text: "Read src/lib/auth.ts. Identified two candidate strategies.",
    },
    {
      id: "e3",
      kind: "question",
      timestamp: "14:06",
      text: "Invalidate all tokens on password change, or only the current session?",
    },
  ],
  "t-db": [
    {
      id: "e1",
      kind: "user",
      timestamp: "13:40",
      text: "Migrate the schema to tenant-scoped tables.",
    },
    {
      id: "e2",
      kind: "agent",
      timestamp: "13:41",
      text: "Read schema.prisma, drafted migration_v2.sql.",
    },
    {
      id: "e3",
      kind: "agent",
      timestamp: "13:44",
      text: "$ generating migration_v2.sql...",
    },
  ],
  "t-ci": [
    {
      id: "e1",
      kind: "user",
      timestamp: "12:10",
      text: "Fix the CI pipeline — ledger tests keep flaking.",
    },
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
    {
      id: "e1",
      kind: "user",
      timestamp: "yesterday",
      text: "Scaffold the hostel management feature end-to-end.",
    },
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
