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

/** GET / */
export interface Health {
  status: string;
  model: string;
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
