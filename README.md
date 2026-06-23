# WC26 Match Model — Web

Vite + React + TypeScript front end for the WC2026 prediction API. The API base
URL is read from a build-time environment variable; the page calls the API live
and falls back to an embedded snapshot if the API is unreachable.

## Local dev

```bash
npm install
cp .env.example .env        # set VITE_API_URL
npm run dev                 # http://localhost:5173
npm run typecheck           # tsc --noEmit — type-check only, not run by the build
npm run build               # -> dist/ (VITE_API_URL is baked in at build time)
```

In dev, a small **API URL** field lets you point at a local/staging API without
editing `.env`. It's hidden in production builds, where `VITE_API_URL` is the
single source of truth (and the CSP `connect-src` is pinned to that origin).

## Environment variable

| Var | What | Notes |
|---|---|---|
| `VITE_API_URL` | Base URL of your prediction API | **Public** — Vite inlines `VITE_*` into the built JS, so anyone can read it. Fine for a public API URL. **Never** put secrets here. |

Set it wherever you build: a `.env` file locally, or the host's env settings
(Vercel/Netlify/Railway). The build must re-run after changing it.

## Deploy

### Vercel (recommended for the front end)
1. Push this folder to a repo and import it in Vercel (auto-detects Vite).
2. Project → Settings → Environment Variables → add `VITE_API_URL`.
3. Deploy. Security headers come from `vercel.json`.

### Netlify
Same idea: set `VITE_API_URL`, build command `vite build`, publish dir `dist`.
(Add a `_headers` file if you want the same headers as `vercel.json`.)

### Railway (keeps it next to the API)
1. New service → deploy this repo. Nixpacks runs `npm install` + `npm run build`.
2. Variables → add `VITE_API_URL` (needed at build time).
3. Start command is `serve -s dist -l $PORT` (from `railway.json`); headers come
   from `public/serve.json`.
4. Settings → Networking → Generate Domain.

## Security

What this project does, and the honest limits:

1. **API URL via env, not hard-coded.** Swappable per environment. Still public
   (see the table above) — it's a URL, not a secret, so that's fine.

2. **CORS locked to your origin.** Replace `app.py` in the API repo with
   `api-security/app.py`, then set `ALLOWED_ORIGINS` on the API service to your
   front-end origin (e.g. `https://your-app.vercel.app`). This stops other
   websites' browsers from calling your API.
   *Limit:* CORS is a browser rule. It does **not** stop `curl`/scripts. For a
   public prediction model with no sensitive data that's an acceptable tradeoff.

3. **Security headers** (`vercel.json` / `public/serve.json`):
   - `Content-Security-Policy` — scripts only from same origin (no inline JS),
     network calls (`connect-src`) only to same origin + your API, fonts limited
     to Google Fonts. **If you change `VITE_API_URL`, update `connect-src` in
     both files to match**, or the browser will block the API call.
   - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
     `Referrer-Policy`, and a minimal `Permissions-Policy`.

4. **Not a secret store.** Because the bundle is public, don't try to "hide" an
   API key in the front end — a key shipped to the browser is visible in
   DevTools. If you ever need real gating, add it server-side (rate limiting or
   auth on the API), e.g. `slowapi` for per-IP rate limits:
   ```python
   # pip install slowapi  — then limit the /predict route per client IP
   ```
   For this model, locking CORS + headers is the proportionate step.
