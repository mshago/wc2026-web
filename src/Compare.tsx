// Model comparison — consumes GET /compare and GET /compare/scoreboard.
//   • ModelCompare (default): a quiet, collapsed-by-default section under the
//     match card showing both models' 1X2 probabilities side by side. It self-
//     fetches and renders NOTHING on any error/404, so non-World-Cup matchups
//     simply hide the comparison instead of surfacing an error.
//   • Scoreboard: the held-out backtest accuracy view for both models.
// Styling stays deliberately quiet — the heat grid remains the one bold element.
import React, { useEffect, useState } from "react";
import { C, pct, pct0 } from "./theme";
import { fetchCompare, fetchScoreboard, fetchHealth } from "./api";
import type { Outcome, CompareResponse, ScoreboardResponse, ScoreboardMetrics } from "./types";

const cardStyle: React.CSSProperties = {
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20,
};

// ---------------------------------------------------------------------------
// A) Per-fixture side-by-side
// ---------------------------------------------------------------------------

function ProbBar({ o }: { o: Outcome }) {
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: C.panel2 }}>
      <div className="seg" style={{ width: pct(o.home_win), background: C.home }} />
      <div className="seg" style={{ width: pct(o.draw), background: C.draw }} />
      <div className="seg" style={{ width: pct(o.away_win), background: C.away }} />
    </div>
  );
}

function ModelRow({ name, tag, o }: { name: string; tag?: string; o: Outcome }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div className="font-mono" style={{ fontSize: 11, color: C.ink }}>
          {name}{tag && <span style={{ color: C.faint }}> {tag}</span>}
        </div>
        <div className="font-mono" style={{ fontSize: 11, color: C.dim, whiteSpace: "nowrap" }}>
          <span style={{ color: C.home }}>{pct0(o.home_win)}</span>
          {" · "}<span style={{ color: C.draw }}>{pct0(o.draw)}</span>
          {" · "}<span style={{ color: C.away }}>{pct0(o.away_win)}</span>
        </div>
      </div>
      <ProbBar o={o} />
    </div>
  );
}

/**
 * Compact two-model comparison for a single fixture. Renders nothing until
 * /compare returns 200; hides itself on 404 (unknown team or non-WC pair) or
 * any other failure. Collapsed by default to stay unobtrusive.
 */
export default function ModelCompare(
  { apiUrl, home, away, version }: { apiUrl: string; home: string; away: string; version?: string | null },
) {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    (async () => {
      try {
        const r = await fetchCompare(apiUrl, home, away, version);
        if (!cancelled) setData(r);
      } catch {
        // Non-WC pair, unknown team, or API unreachable — hide the section.
        if (!cancelled) setData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [apiUrl, home, away, version]);

  if (!data) return null;

  return (
    <div style={{ ...cardStyle, marginTop: 18 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
          background: "transparent", border: "none", color: C.ink, cursor: "pointer", padding: 0, textAlign: "left",
        }}
      >
        <span>
          <span className="font-display panel-title">Model comparison</span>
          <span className="font-mono" style={{ color: C.faint, fontSize: 10, marginLeft: 8 }}>
            production vs challenger · neutral venue
          </span>
        </span>
        <span className="font-mono" style={{ color: C.dim, fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>▾</span>
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          <ModelRow name="Bayesian" tag="(production)" o={data.bayesian} />
          <ModelRow name="XGBoost" tag="(challenger)" o={data.xgboost} />
          <div className="font-mono" style={{ color: C.faint, fontSize: 10 }}>
            <span style={{ color: C.home }}>{home}</span> · draw · <span style={{ color: C.away }}>{away}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// B) Model scoreboard
// ---------------------------------------------------------------------------

type MetricKey = keyof ScoreboardMetrics;

// hit_rate: higher is better; log_loss & brier: lower is better.
const METRICS: { key: MetricKey; label: string; hint: string; higherBetter: boolean; fmt: (v: number) => string }[] = [
  { key: "hit_rate", label: "Hit rate", hint: "top pick matched the result", higherBetter: true, fmt: pct },
  { key: "log_loss", label: "Log loss", hint: "calibration", higherBetter: false, fmt: (v) => v.toFixed(3) },
  { key: "brier", label: "Brier", hint: "calibration", higherBetter: false, fmt: (v) => v.toFixed(3) },
];

/** Which model wins a metric, or null on a tie. */
function winner(m: ScoreboardResponse["models"], key: MetricKey, higherBetter: boolean): "bayesian" | "xgboost" | null {
  const b = m.bayesian[key], x = m.xgboost[key];
  if (b === x) return null;
  const bayesianWins = higherBetter ? b > x : b < x;
  return bayesianWins ? "bayesian" : "xgboost";
}

function ScoreCell({ value, isWinner }: { value: string; isWinner: boolean }) {
  return (
    <td className="font-mono" style={{ padding: "10px 8px", textAlign: "right", color: isWinner ? C.win : C.ink }}>
      {value}{isWinner && <span style={{ marginLeft: 6, fontSize: 10, color: C.win }}>✓</span>}
    </td>
  );
}

export function Scoreboard({ apiUrl }: { apiUrl: string }) {
  const [data, setData] = useState<ScoreboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true); setError(null);
      try {
        // Key the cache on model_version when the API exposes one.
        const version = await fetchHealth(apiUrl).then((h) => h.model_version).catch(() => null);
        const r = await fetchScoreboard(apiUrl, version);
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(`Couldn't load the scoreboard (${e instanceof Error ? e.message : String(e)}). This view needs the live API.`);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiUrl]);

  if (busy) return <div className="font-mono" style={{ color: C.dim, fontSize: 13, padding: 8 }}>Loading scoreboard…</div>;
  if (error) return <div style={{ fontSize: 13, color: C.warn, padding: 8 }}>{error}</div>;
  if (!data) return <div className="font-mono" style={{ color: C.dim, fontSize: 13, padding: 8 }}>No scoreboard available.</div>;

  const wins = METRICS.map((m) => winner(data.models, m.key, m.higherBetter));
  const bayesianWins = wins.filter((w) => w === "bayesian").length;
  const summary =
    bayesianWins === METRICS.length
      ? "On this backtest the Bayesian (production) model leads on every metric; XGBoost tends to over-predict draws."
      : bayesianWins === 0
      ? "On this backtest the XGBoost challenger leads on every metric."
      : `On this backtest the Bayesian (production) model leads on ${bayesianWins} of ${METRICS.length} metrics.`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={cardStyle}>
        <div className="font-display panel-title">Model scoreboard</div>
        <div className="font-mono" style={{ color: C.faint, fontSize: 10, marginBottom: 16 }}>
          held-out backtest · {data.n_matches.toLocaleString()} matches · {data.holdout}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: C.faint, textAlign: "left" }} className="font-mono">
              <th style={{ padding: "8px 8px", fontWeight: 400 }}>Metric</th>
              <th style={{ padding: "8px 8px", textAlign: "right" }}>
                Bayesian <span style={{ color: C.home }}>(production)</span>
              </th>
              <th style={{ padding: "8px 8px", textAlign: "right" }}>XGBoost <span style={{ color: C.dim }}>(challenger)</span></th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m, i) => (
              <tr key={m.key} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: "10px 8px" }}>
                  <span style={{ color: C.ink }}>{m.label}</span>
                  <span className="font-mono" style={{ color: C.faint, fontSize: 10, marginLeft: 8 }}>
                    {m.hint} · {m.higherBetter ? "higher better" : "lower better"}
                  </span>
                </td>
                <ScoreCell value={m.fmt(data.models.bayesian[m.key])} isWinner={wins[i] === "bayesian"} />
                <ScoreCell value={m.fmt(data.models.xgboost[m.key])} isWinner={wins[i] === "xgboost"} />
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ color: C.dim, fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
          {summary} <span className="font-mono" style={{ color: C.faint, fontSize: 11 }}>✓ marks the better model per metric.</span>
        </div>
      </div>
    </div>
  );
}
