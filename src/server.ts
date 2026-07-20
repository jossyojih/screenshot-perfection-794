import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const runnerRoutes = [
  /^\/projects(?:\/[^/]+)?$/,
  /^\/jobs(?:\/[^/]+(?:\/(?:events|cancel|reply))?)?$/,
];

function serverEnv(env: unknown, key: "RUNNER_API_BASE_URL" | "RUNNER_API_TOKEN") {
  const runtime =
    env && typeof env === "object" ? (env as Record<string, unknown>)[key] : undefined;
  return typeof runtime === "string" ? runtime : process.env[key];
}

async function proxyRunnerRequest(request: Request, env: unknown): Promise<Response> {
  const incoming = new URL(request.url);
  const path = incoming.pathname.slice("/api/runner".length) || "/";
  if (!runnerRoutes.some((route) => route.test(path))) {
    return Response.json({ message: "Unknown runner API route" }, { status: 404 });
  }

  const baseUrl = serverEnv(env, "RUNNER_API_BASE_URL") ?? "http://127.0.0.1:4000";
  const token = serverEnv(env, "RUNNER_API_TOKEN");
  if (!token) {
    return Response.json({ message: "Runner API is not configured" }, { status: 503 });
  }

  const target = new URL(path + incoming.search, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
      // Required by Node when forwarding a streaming request body.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const responseHeaders = new Headers();
    for (const name of ["content-type", "cache-control", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    if (path.endsWith("/events")) {
      responseHeaders.set("cache-control", "no-cache, no-transform");
      responseHeaders.set("x-accel-buffering", "no");
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ message: "Runner API is unavailable" }, { status: 502 });
  }
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (new URL(request.url).pathname.startsWith("/api/runner/")) {
        return await proxyRunnerRequest(request, env);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
