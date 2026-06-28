// Types mirroring the prediction API contract (GET /predict). See README/brief.
// The API is a separate repo; treat these as the wire format.

export interface ExpectedGoals {
  home: number;
  away: number;
}

export interface Outcome {
  home_win: number;
  draw: number;
  away_win: number;
}

export interface MostLikelyScore {
  home: number;
  away: number;
  prob: number;
}

export interface ScoreCell {
  /** Formatted scoreline, e.g. "1-1". */
  score: string;
  home: number;
  away: number;
  prob: number;
}

/** 90% credible interval, shared by uncertainty + ratings responses. */
export interface CI {
  mean: number;
  p05: number;
  p95: number;
}

/** Over/under line for a single goal threshold. */
export interface OverUnderLine {
  over: number;
  under: number;
}

/** `markets` extra: requested via ?extras=markets. */
export interface Markets {
  over_under: Record<"0.5" | "1.5" | "2.5" | "3.5", OverUnderLine>;
  /** Both teams to score. */
  btts: number;
  clean_sheet: { home: number; away: number };
}

/** `margin` extra: goal-difference (home − away) distribution, −5..+5. */
export interface MarginPoint {
  diff: number;
  prob: number;
}

/** `uncertainty` extra: credible-interval bands on the headline numbers. */
export interface Uncertainty {
  outcome: { home_win: CI; draw: CI; away_win: CI };
  expected_goals: { home: CI; away: CI };
}

export interface Prediction {
  home: string;
  away: string;
  neutral: boolean;
  expected_goals: ExpectedGoals;
  outcome: Outcome;
  most_likely_score: MostLikelyScore;
  top_scores: ScoreCell[];
  /**
   * score_matrix[i][j] = P(home scores i, away scores j). Square; size varies
   * (live API 0-6, embedded snapshot 0-7) — always read score_matrix.length.
   */
  score_matrix: number[][];
  /**
   * Echoes the `venue` param (host country) or null. Always present on the live
   * API; absent on embedded snapshots, so normalized to null on parse.
   */
  venue?: string | null;
  /** Crowd advantage applied, range [-1, +1]. Live-only; normalized to 0 on parse. */
  support?: number;
  /** Present only when requested via ?extras=markets (or `all`). */
  markets?: Markets;
  /** Present only when requested via ?extras=margin (or `all`). */
  margin?: MarginPoint[];
  /** Present only when requested via ?extras=uncertainty (or `all`). */
  uncertainty?: Uncertainty;
  /** Only present on the embedded fixture snapshots, not the live API response. */
  date?: string;
}

/** Alias matching the brief's vocabulary for the GET /predict body. */
export type PredictResponse = Prediction;

// ---- model comparison (GET /compare, GET /compare/scoreboard) ----

/**
 * GET /compare?home=&away= — both models' 1X2 probabilities for a fixture,
 * always at a neutral venue (no neutral/venue params). Each block is an
 * `Outcome` (three probabilities summing to ~1). `bayesian` is production,
 * `xgboost` the challenger. 404 if a team is unknown OR the pair isn't a
 * precomputed World Cup matchup.
 */
export interface CompareResponse {
  home: string;
  away: string;
  bayesian: Outcome;
  xgboost: Outcome;
}

/** Backtest metrics for one model. hit_rate higher = better; the rest lower = better. */
export interface ScoreboardMetrics {
  /** Share of matches where the model's top pick was the actual result. */
  hit_rate: number;
  log_loss: number;
  brier: number;
}

/** GET /compare/scoreboard — held-out backtest accuracy of both models. */
export interface ScoreboardResponse {
  /** Human-readable description of the held-out split. */
  holdout: string;
  n_matches: number;
  models: {
    bayesian: ScoreboardMetrics;
    xgboost: ScoreboardMetrics;
  };
}

/** GET / — health plus the model cache key. */
export interface Health {
  status: string;
  model: string;
  /**
   * Cache key for predictions: changes when the model refreshes (daily). May be
   * null right after a deploy until the first refresh — treat null as "no
   * version yet" and don't cache against it. Likewise model_trained_at.
   */
  model_version: string | null;
  model_trained_at: string | null;
  teams_available: number;
  usage: string;
}

/** GET /teams */
export interface TeamsResponse {
  count: number;
  teams: string[];
}

/** GET /ratings — one row per team, ranked desc by `rating`. */
export interface TeamRating {
  team: string;
  attack: CI;
  defense: CI;
  rating: number;
}

export interface RatingsResponse {
  count: number;
  teams: TeamRating[];
}

// ---- schedule API (GET /fixtures) ----
// Source of truth for which matches exist and the bracket as it resolves. The
// prediction API does NOT know the schedule; we map names then predict.

/** Tournament stage, ordered group → final. */
export type Stage =
  | "GROUP_STAGE"
  | "LAST_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "THIRD_PLACE"
  | "FINAL";

/**
 * One scheduled match. `home`/`away` are the SCHEDULE API's team names (not
 * necessarily the prediction API's canonical names — map via teamMap) and are
 * null for undetermined knockout slots. `*_known` flags whether the slot holds
 * a resolvable team. `venue_country`, when set, is the host nation to pass as
 * `venue=` to /predict; null + `neutral:true` means a genuinely neutral game.
 */
export interface ScheduleMatch {
  id: number;
  utc_date: string;
  status: "FINISHED" | "TIMED" | string;
  stage: Stage;
  group: string | null;
  home: string | null;
  away: string | null;
  home_known: boolean;
  away_known: boolean;
  venue: string | null;
  venue_country: string | null;
  neutral: boolean;
  played: boolean;
  result: { home: number; away: number } | null;
}

/** GET /fixtures */
export interface ScheduleResponse {
  count: number;
  fixtures: ScheduleMatch[];
}
