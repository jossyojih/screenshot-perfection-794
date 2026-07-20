import { Check, Command, LockKeyhole, RadioTower } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";

export function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await login({ password }, remember);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-4 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,var(--glow-soft),transparent_38%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl border border-glow/40 bg-glow-soft text-glow shadow-[var(--shadow-glow-soft)]">
            <Command className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Command Center</h1>
            <p className="text-[9px] font-mono uppercase tracking-[.24em] text-muted">
              Remote engineering
            </p>
          </div>
        </div>
        <form
          onSubmit={submit}
          className="rounded-2xl border border-edge bg-surface/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-glow">
              <RadioTower className="size-3.5" /> Secure runner access
            </div>
            <h2 className="text-xl font-semibold">Welcome back</h2>
            <p className="mt-2 text-sm text-muted">Sign in to manage projects and coding agents.</p>
          </div>
          <label className="mb-4 block">
            <span className="mb-2 block text-[10px] font-mono uppercase tracking-widest text-muted">
              Password
            </span>
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-3.5 size-4 text-muted" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-lg border border-edge bg-void pl-11 pr-4 text-sm outline-none transition focus:border-glow/60"
              />
            </div>
          </label>
          <label className="mb-6 flex cursor-pointer items-start gap-3 text-xs text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="peer sr-only"
            />
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-edge bg-void peer-checked:border-glow peer-checked:bg-glow peer-checked:text-void">
              <Check className={`size-3 ${remember ? "" : "invisible"}`} />
            </span>
            <span>
              <span className="block text-foreground">Remember this device</span>
              <span className="mt-1 block text-[10px] leading-relaxed">
                Keep the backend-provided session across app launches. Avoid on shared devices.
              </span>
            </span>
          </label>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-danger/40 bg-danger-soft p-3 text-xs text-danger"
            >
              {error}
            </div>
          )}
          <button
            disabled={submitting || !password}
            className="h-12 w-full rounded-lg bg-glow font-mono text-xs font-bold uppercase tracking-widest text-void disabled:bg-edge disabled:text-muted"
          >
            {submitting ? "Authenticating…" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-center text-[9px] font-mono uppercase tracking-widest text-muted">
          TLS protected · Credentials are never stored
        </p>
      </div>
    </main>
  );
}
