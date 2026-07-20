# Command Center PWA

This repository builds a static, installable frontend. It calls the runner directly through the public HTTPS URL in `VITE_RUNNER_API_URL`; the API must allow the Render origin with CORS and permit `Authorization`, `Content-Type`, `Accept`, and `Last-Event-ID` headers.

## Render static-site settings

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_RUNNER_API_URL=https://your-ec2-or-tailscale-https-api.example`
- Rewrite rule: source `/*`, destination `/index.html`, action `Rewrite`

Do not configure `RUNNER_API_TOKEN` or any backend secret in Render. Vite variables are public build-time values.

For local development, copy `.env.example` to `.env.local`, set the public API URL, then run `npm install && npm run dev`. Production can be checked with `npm run build && npm run preview`; refresh a nested route such as `/threads/test-id` to exercise the SPA fallback (the host rewrite provides this behavior on Render).

The service worker caches only the unauthenticated application shell and same-origin static assets. API calls, Authorization-bearing requests, job events, and sessions are never cached. Sessions remain in memory unless the user selects **Remember this device**, in which case only the access token and backend-provided expiry are stored locally and cleared on logout, expiry, or a 401 response.
