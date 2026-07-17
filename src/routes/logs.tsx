import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { threads, projectById } from "@/lib/mock-data";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Logs — Command Center" },
      { name: "description", content: "Raw agent activity across every thread." },
    ],
  }),
  component: LogsPage,
});

function LogsPage() {
  return (
    <AppShell title="Logs">
      <div className="px-4 py-4 space-y-3">
        <h2 className="text-[11px] font-mono uppercase text-muted tracking-widest mb-1">
          Agent_Stream
        </h2>
        <div className="rounded-lg border border-edge bg-void p-3 font-mono text-[11px] leading-relaxed text-muted space-y-2">
          {threads.map((t) => {
            const p = projectById(t.projectId);
            return (
              <div key={t.id} className="border-b border-edge/60 pb-2 last:border-b-0 last:pb-0">
                <span className="text-glow">[{t.updatedAt}]</span>{" "}
                <span className="text-foreground/70">{p?.name}</span>{" "}
                <span className="text-muted">›</span> {t.title.toLowerCase()} —{" "}
                <span
                  className={
                    t.status === "running"
                      ? "text-glow"
                      : t.status === "needs_input"
                        ? "text-alert"
                        : "text-muted"
                  }
                >
                  {t.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
