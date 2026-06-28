// Typed fetch helpers for the prediction + schedule APIs (same origin). All
// endpoints are GET. The base URL is the public VITE_API_URL (see .env.example);
// callers pass it in.
import { apiBase } from "./theme";
import type {
  Prediction,
  RatingsResponse,
  CompareResponse,
  ScoreboardResponse,
  Health,
  ScheduleResponse,
  TeamsResponse,
} from "./types";

/** Comma-separated subset of these, or the literal "all". */
export type ExtraKey = "markets" | "margin" | "uncertainty";

export interface PredictOptions {
  /** Host country; when set, OVERRIDES `neutral` and derives crowd support. */
  venue?: string | null;
  /** Extras to request. Omit/empty to keep the payload small. */
  extras?: ExtraKey[];
  /**
   * Model cache key from GET / (`model_version`). When a non-empty string, the
   * result is cached against it and reused until the model refreshes. Omit or
   * pass null to always fetch live (the existing prediction view does this).
   */
  version?: string | null;
}

/**
 * Reads FastAPI's `{ detail }` body so 404 (unknown team) and 400 (bad extras)
 * surface a real message instead of a bare status code.
 */
async function failure(r: Response): Promise<Error> {
  let detail = `HTTP ${r.status}`;
  try {
    const body = await r.json();
    if (body && typeof body.detail === "string") detail = body.detail;
  } catch {
    /* non-JSON error body — keep the status fallback */
  }
  return new Error(detail);
}

// ---- model-version-keyed caches ----
// Keys are prefixed with the model_version so a daily model refresh transparently
// invalidates everything; entries for old versions simply go unread. A null/empty
// version means "no version yet" — we skip the cache and always fetch live.
const predictCache = new Map<string, Prediction>();
const compareCache = new Map<string, CompareResponse>();
const scoreboardCache = new Map<string, ScoreboardResponse>();

const versionKey = (version: string | null | undefined, k: string) =>
  version ? `${version}::${k}` : null;

export async function fetchPredict(
  base: string,
  home: string,
  away: string,
  neutral: boolean,
  opts: PredictOptions = {},
): Promise<Prediction> {
  const q = new URLSearchParams({ home, away, neutral: String(neutral) });
  // venue overrides neutral server-side; only send it when chosen.
  if (opts.venue) q.set("venue", opts.venue);
  if (opts.extras && opts.extras.length) q.set("extras", opts.extras.join(","));

  const query = q.toString();
  const ck = versionKey(opts.version, `predict?${query}`);
  if (ck) {
    const hit = predictCache.get(ck);
    if (hit) return hit;
  }

  const r = await fetch(`${apiBase(base)}/predict?${query}`);
  if (!r.ok) throw await failure(r);

  const data = (await r.json()) as Prediction;
  // Snapshots/older payloads may omit the always-present fields — normalize so
  // downstream code can read them unconditionally.
  const normalized = { ...data, venue: data.venue ?? null, support: data.support ?? 0 };
  if (ck) predictCache.set(ck, normalized);
  return normalized;
}

export async function fetchRatings(base: string): Promise<RatingsResponse> {
  const r = await fetch(`${apiBase(base)}/ratings`);
  if (!r.ok) throw await failure(r);
  return (await r.json()) as RatingsResponse;
}

/**
 * GET /compare — both models' 1X2 probabilities for a fixture. Always neutral
 * (no neutral/venue params). Throws on non-200, including the 404 for unknown
 * teams or a non-World-Cup pair; callers hide the comparison on any failure.
 * Pass `version` (model_version) to cache the result until the model refreshes.
 */
export async function fetchCompare(
  base: string,
  home: string,
  away: string,
  version?: string | null,
): Promise<CompareResponse> {
  const q = new URLSearchParams({ home, away });
  const ck = versionKey(version, `compare?${q.toString()}`);
  if (ck) {
    const hit = compareCache.get(ck);
    if (hit) return hit;
  }
  const r = await fetch(`${apiBase(base)}/compare?${q.toString()}`);
  if (!r.ok) throw await failure(r);
  const data = (await r.json()) as CompareResponse;
  if (ck) compareCache.set(ck, data);
  return data;
}

/**
 * GET /compare/scoreboard — held-out backtest accuracy. Static between model
 * refreshes, so cached against `version` (model_version) when available.
 */
export async function fetchScoreboard(
  base: string,
  version?: string | null,
): Promise<ScoreboardResponse> {
  const key = apiBase(base);
  const ck = versionKey(version, `scoreboard::${key}`);
  if (ck) {
    const hit = scoreboardCache.get(ck);
    if (hit) return hit;
  }
  const r = await fetch(`${key}/compare/scoreboard`);
  if (!r.ok) throw await failure(r);
  const data = (await r.json()) as ScoreboardResponse;
  if (ck) scoreboardCache.set(ck, data);
  return data;
}

// ---- health + schedule ----

let healthCache: { base: string; data: Health; at: number } | null = null;
const HEALTH_TTL = 60_000;

/** GET / — health + the model cache key. Cached for a short TTL. */
export async function fetchHealth(base: string): Promise<Health> {
  const key = apiBase(base);
  if (healthCache && healthCache.base === key && Date.now() - healthCache.at < HEALTH_TTL) {
    return healthCache.data;
  }
  const r = await fetch(`${key}/`);
  if (!r.ok) throw await failure(r);
  const data = (await r.json()) as Health;
  healthCache = { base: key, data, at: Date.now() };
  return data;
}

let teamsCache: { base: string; data: TeamsResponse } | null = null;

/** GET /teams — the ~204 canonical names. Cached for the page lifetime. */
export async function fetchTeams(base: string): Promise<TeamsResponse> {
  const key = apiBase(base);
  if (teamsCache && teamsCache.base === key) return teamsCache.data;
  const r = await fetch(`${key}/teams`);
  if (!r.ok) throw await failure(r);
  const data = (await r.json()) as TeamsResponse;
  teamsCache = { base: key, data };
  return data;
}

let scheduleCache: { base: string; data: ScheduleResponse; at: number } | null = null;
const SCHEDULE_TTL = 60_000; // bracket changes as matches resolve — keep it short

/** GET /fixtures — the schedule/bracket. Cached with a short TTL. */
export async function fetchSchedule(base: string): Promise<ScheduleResponse> {
  const key = apiBase(base);
  if (scheduleCache && scheduleCache.base === key && Date.now() - scheduleCache.at < SCHEDULE_TTL) {
    return scheduleCache.data;
  }
  const r = await fetch(`${key}/fixtures`);
  if (!r.ok) throw await failure(r);
  const data = (await r.json()) as ScheduleResponse;
  scheduleCache = { base: key, data, at: Date.now() };
  return data;
}
