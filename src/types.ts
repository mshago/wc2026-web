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
  /** Only present on the embedded fixture snapshots, not the live API response. */
  date?: string;
}
