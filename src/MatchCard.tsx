// The signature forecast card: scoreline, win/draw/loss, the glowing scoreline
// heat grid, and the top-10 exact scores. Shared by the "Any matchup" view and
// the schedule-driven Fixtures view. Renders a single /predict Prediction.
import React, { useMemo } from "react";
import type { Prediction } from "./types";
import { C, heat, pct, pct0, outcomeColor } from "./theme";

export default function MatchCard({ p }: { p: Prediction }) {
  const maxCell = useMemo(() => {
    let m = 0;
    p.score_matrix.forEach((row) => row.forEach((v) => (m = Math.max(m, v))));
    return m;
  }, [p]);
  const ml = p.most_likely_score, o = p.outcome;
  const topMax = Math.max(...p.top_scores.map((s) => s.prob));
  const venue = p.neutral ? "Neutral venue" : `${p.home} at home`;
  const N = p.score_matrix.length;

  return (
    <div className="card-fade" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div className="rounded-2xl" style={{ background: `linear-gradient(180deg, ${C.panel} 0%, ${C.panel2} 100%)`, border: `1px solid ${C.line}`, padding: "26px 24px" }}>
        <div className="font-mono" style={{ color: C.faint, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 18 }}>
          {p.date ? `${p.date}  ·  ` : ""}{venue}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display team-name" style={{ color: C.home }}>{p.home}</div>
            <div className="font-mono" style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>xG {p.expected_goals.home.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div className="font-mono score-big" style={{ color: C.ink }}>
              {ml.home}<span style={{ color: C.faint, margin: "0 6px" }}>–</span>{ml.away}
            </div>
            <div className="font-mono" style={{ color: C.faint, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 2 }}>
              likely score · {pct0(ml.prob)}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
            <div className="font-display team-name" style={{ color: C.away }}>{p.away}</div>
            <div className="font-mono" style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>xG {p.expected_goals.away.toFixed(2)}</div>
          </div>
        </div>
        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          {[{ lab: p.home, v: o.home_win, col: C.home }, { lab: "Draw", v: o.draw, col: C.draw }, { lab: p.away, v: o.away_win, col: C.away }].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div className="font-mono" style={{ color: s.col, fontSize: 26, fontWeight: 700 }}>{pct0(s.v)}</div>
              <div style={{ color: C.dim, fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.lab}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: C.panel2 }}>
          <div style={{ width: pct(o.home_win), background: C.home }} className="seg" />
          <div style={{ width: pct(o.draw), background: C.draw }} className="seg" />
          <div style={{ width: pct(o.away_win), background: C.away }} className="seg" />
        </div>
      </div>

      <div className="grid-2">
        <div className="rounded-2xl" style={{ background: C.panel, border: `1px solid ${C.line}`, padding: 20 }}>
          <div className="font-display panel-title">Scoreline heat map</div>
          <div className="font-mono" style={{ color: C.faint, fontSize: 10, marginBottom: 14 }}>probability of every exact score</div>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginRight: 6 }}>
              <span className="axis-label" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", color: C.home }}>{p.home} goals</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: `18px repeat(${N}, 1fr)`, gap: 3 }}>
                <div />
                {Array.from({ length: N }).map((_, j) => (<div key={j} className="font-mono cell-tick" style={{ color: C.faint }}>{j}</div>))}
                {p.score_matrix.map((row, i) => (
                  <React.Fragment key={i}>
                    <div className="font-mono cell-tick" style={{ color: C.faint, display: "flex", alignItems: "center", justifyContent: "center" }}>{i}</div>
                    {row.map((v, j) => {
                      const isML = i === ml.home && j === ml.away;
                      const t = maxCell ? v / maxCell : 0;
                      return (
                        <div key={j} title={`${i}-${j}: ${pct(v)}`} className="heat-cell font-mono"
                          style={{ background: heat(t), color: t > 0.5 ? "#fff" : "rgba(255,255,255,0.62)", boxShadow: isML ? `inset 0 0 0 2px ${C.win}` : "none" }}>
                          {v >= 0.01 ? Math.round(v * 100) : ""}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="axis-label" style={{ textAlign: "center", color: C.away, marginTop: 8 }}>{p.away} goals</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl" style={{ background: C.panel, border: `1px solid ${C.line}`, padding: 20 }}>
          <div className="font-display panel-title">Top 10 likely scores</div>
          <div className="font-mono" style={{ color: C.faint, fontSize: 10, marginBottom: 14 }}>colour shows who the score favours</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {p.top_scores.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="font-mono" style={{ width: 34, color: C.ink, fontSize: 13 }}>{s.score}</div>
                <div style={{ flex: 1, height: 16, background: C.panel2, borderRadius: 4, overflow: "hidden" }}>
                  <div className="seg" style={{ width: pct(s.prob / topMax), height: "100%", background: outcomeColor(s.home, s.away), opacity: 0.85 }} />
                </div>
                <div className="font-mono" style={{ width: 44, textAlign: "right", color: C.dim, fontSize: 12 }}>{pct(s.prob)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
