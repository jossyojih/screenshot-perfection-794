import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusDot, StatusPill } from "@/components/StatusPill";
import { projectById, threadById, timeline } from "@/lib/mock-data";
import type { TimelineEntry } from "@/lib/mock-data";

export const Route = createFileRoute("/threads/$threadId")({
  loader: ({ params }) => {
    const thread = threadById(params.threadId);
    if (!thread) throw notFound();
    return { thread };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Thread not found — Command Center" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return {
      meta: [
        { title: `${loaderData.thread.title} — Command Center` },
        {
          name: "description",
          content: `Activity for thread: ${loaderData.thread.title}. Status: ${loaderData.thread.status}.`,
        },
      ],
    };
  },
  notFoundComponent: () => (
    <AppShell>
      <div className="p-6 text-center text-muted text-sm">Thread not found.</div>
    </AppShell>
  ),
  errorComponent: () => (
    <AppShell>
      <div className="p-6 text-center text-muted text-sm">Something went wrong.</div>
    </AppShell>
  ),
  component: ThreadPage,
});

function ThreadPage() {
  const { thread } = Route.useLoaderData();
  const project = projectById(thread.projectId);
  const entries: TimelineEntry[] = timeline[thread.id] ?? [];
  const [reply, setReply] = useState("");

  return (
    <AppShell
      title={project?.name ?? "Thread"}
      headerRight={
        <Link
          to="/"
          className="text-[10px] font-mono text-muted uppercase tracking-widest hover:text-foreground"
        >
          ← Feed
        </Link>
      }
    >
      <div className="px-4 py-4 space-y-6">
        {/* Header */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <StatusDot status={thread.status} />
            <StatusPill status={thread.status} />
            <span className="text-[10px] text-muted font-mono">· {thread.agent}</span>
          </div>
          <h1 className="text-lg font-semibold leading-tight">{thread.title}</h1>
          <p className="text-[11px] text-muted font-mono mt-1">
            {project?.repos.join(" · ")} · updated {thread.updatedAt}
          </p>
        </section>

        {/* Live state banner */}
        {thread.status === "running" && (
          <div className="rounded-lg border border-glow/30 bg-glow-soft p-3">
            <div className="text-[10px] font-mono text-glow uppercase tracking-widest mb-1">
              Agent is working
            </div>
            <div className="font-mono text-xs text-foreground/90 whitespace-nowrap overflow-hidden">
              {thread.currentAction}
            </div>
          </div>
        )}

        {thread.status === "needs_input" && (
          <div className="rounded-lg border border-alert/40 bg-alert-soft p-4">
            <div className="text-[10px] font-mono text-alert uppercase tracking-widest mb-2">
              Blocked — needs decision
            </div>
            <p className="text-sm leading-relaxed mb-3">{thread.question}</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button className="h-9 rounded-md bg-alert text-void text-xs font-bold uppercase tracking-widest">
                Invalidate all
              </button>
              <button className="h-9 rounded-md border border-edge bg-surface text-xs font-medium">
                Only current
              </button>
            </div>
            <div className="relative">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Or type a custom reply..."
                className="w-full h-10 rounded-md bg-void border border-edge px-3 pr-16 text-xs focus:outline-none focus:border-alert/60"
              />
              <button
                disabled={!reply.trim()}
                className="absolute right-1 top-1 h-8 px-3 rounded bg-foreground text-void text-[10px] font-mono uppercase tracking-widest disabled:bg-edge disabled:text-muted"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <section>
          <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest mb-3">
            Activity
          </h2>
          <ol className="relative border-l border-edge ml-1 space-y-5 pl-5">
            {entries.map((e) => (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[26px] top-1.5 size-2 rounded-full ring-4 ring-void ${
                    e.kind === "user"
                      ? "bg-foreground"
                      : e.kind === "question"
                        ? "bg-alert"
                        : e.kind === "summary"
                          ? "bg-glow"
                          : "bg-muted"
                  }`}
                />
                <div className="text-[10px] font-mono text-muted uppercase tracking-widest mb-1">
                  {e.timestamp} · {labelFor(e.kind)}
                </div>
                <div
                  className={`text-sm leading-relaxed ${
                    e.kind === "user" ? "text-foreground" : "text-foreground/85"
                  }`}
                >
                  {e.text}
                </div>
                {e.bullets && (
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {e.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-glow">▹</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* Done summary card */}
        {thread.status === "done" && (
          <div className="rounded-lg border border-edge bg-surface p-4">
            <div className="text-[10px] font-mono text-glow uppercase tracking-widest mb-2">
              Result
            </div>
            <p className="text-sm mb-2">{thread.summary}</p>
            <p className="text-[11px] text-muted font-mono">{thread.stats}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/compose"
                className="h-9 rounded-md bg-foreground text-void text-xs font-bold uppercase tracking-widest flex items-center justify-center"
              >
                Continue
              </Link>
              <button className="h-9 rounded-md border border-edge bg-surface text-xs font-medium">
                Pull locally
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function labelFor(kind: TimelineEntry["kind"]) {
  switch (kind) {
    case "user":
      return "You";
    case "agent":
      return "Agent";
    case "question":
      return "Question";
    case "summary":
      return "Summary";
    default:
      return "System";
  }
}
