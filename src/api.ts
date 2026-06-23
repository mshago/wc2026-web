// Typed fetch helpers for the prediction API. All endpoints are GET. The base
// URL is the public VITE_API_URL (see .env.example); callers pass it in.
import { apiBase } from "./theme";
import type { Prediction, RatingsResponse } from "./types";

/** Comma-separated subset of these, or the literal "all". */
export type ExtraKey = "markets" | "margin" | "uncertainty";

export interface PredictOptions {
  /** Host country; when set, OVERRIDES `neutral` and derives crowd support. */
  venue?: string | null;
  /** Extras to request. Omit/empty to keep the payload small. */
  extras?: ExtraKey[];
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

  const r = await fetch(`${apiBase(base)}/predict?${q.toString()}`);
  if (!r.ok) throw await failure(r);

  const data = (await r.json()) as Prediction;
  // Snapshots/older payloads may omit the always-present fields — normalize so
  // downstream code can read them unconditionally.
  return { ...data, venue: data.venue ?? null, support: data.support ?? 0 };
}

export async function fetchRatings(base: string): Promise<RatingsResponse> {
  const r = await fetch(`${apiBase(base)}/ratings`);
  if (!r.ok) throw await failure(r);
  return (await r.json()) as RatingsResponse;
}
