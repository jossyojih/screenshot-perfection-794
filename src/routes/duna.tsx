import { createFileRoute } from "@tanstack/react-router";
import { Waves } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/duna")({
  head: () => ({ meta: [{ title: "Duna — Command Center" }] }),
  component: DunaPage,
});

function DunaPage() {
  return (
    <AppShell title="Duna">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
        <div className="rounded-xl border border-edge bg-surface p-6">
          <Waves className="size-5 text-glow" />
          <h2 className="mt-4 text-xl font-semibold">Duna</h2>
        </div>
      </div>
    </AppShell>
  );
}
