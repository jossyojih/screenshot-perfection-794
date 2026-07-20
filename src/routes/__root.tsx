import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-4 text-foreground">
      <div className="text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-3 text-sm text-muted">This command-center route does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-glow px-4 py-2 text-xs font-bold text-void"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-4 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn’t load</h1>
        <p className="mt-2 text-sm text-muted">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-md bg-glow px-4 py-2 text-xs font-bold text-void"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { session } = useAuth();
  useEffect(() => {
    if (!session) queryClient.clear();
  }, [session, queryClient]);
  if (!session) return <LoginScreen />;
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <UpdateNotice />
    </QueryClientProvider>
  );
}
function UpdateNotice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const show = () => setAvailable(true);
    window.addEventListener("command-center-update", show);
    return () => window.removeEventListener("command-center-update", show);
  }, []);
  if (!available) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 z-[100] flex items-center justify-between gap-3 rounded-lg border border-glow/40 bg-surface p-4 text-xs shadow-2xl sm:left-auto sm:w-80"
    >
      <span>An app update is ready.</span>
      <button
        onClick={() => window.location.reload()}
        className="rounded bg-glow px-3 py-2 font-mono text-[10px] font-bold uppercase text-void"
      >
        Update
      </button>
    </div>
  );
}
