// Optional detail panels rendered only when the matching `extras` were
// requested and are present on the prediction. Styling stays deliberately quiet
// — the heat grid remains the one bold element.
import React from "react";
import { C, pct, pct0 } from "./theme";
import type { Prediction, CI, Markets, MarginPoint, Uncertainty } from "./types";

const cardStyle: React.CSSProperties = {
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20,
};

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div className="font-display panel-title">{title}</div>
      <div className="font-mono" style={{ color: C.faint, fontSize: 10, marginBottom: 14 }}>{hint}</div>
      {children}
    </div>
  );
}

function MarketsPanel({ m }: { m: Markets }) {
  const lines = ["0.5", "1.5", "2.5", "3.5"] as const;
  return (
    <Panel title="Goal markets" hint="over/under lines · both teams to score · clean sheets">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lines.map((k) => {
          const ou = m.over_under[k];
          return (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="font-mono" style={{ width: 54, color: C.dim, fontSize: 12 }}>O/U {k}</div>
              <div style={{ flex: 1, display: "flex", height: 16, borderRadius: 4, overflow: "hidden", background: C.panel2 }}>
                <div className="seg" style={{ width: pct(ou.over), background: C.home, opacity: 0.85 }} />
                <div className="seg" style={{ width: pct(ou.under), background: C.draw, opacity: 0.6 }} />
              </div>
              <div className="font-mono" style={{ width: 92, textAlign: "right", color: C.dim, fontSize: 11 }}>
                <span style={{ color: C.home }}>O {pct0(ou.over)}</span> · U {pct0(ou.under)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        {[
          { lab: "Both score", v: m.btts, col: C.win },
          { lab: `${"CS"} home`, v: m.clean_sheet.home, col: C.home },
          { lab: "CS away", v: m.clean_sheet.away, col: C.away },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", background: C.panel2, borderRadius: 8, padding: "10px 4px" }}>
            <div className="font-mono" style={{ color: s.col, fontSize: 20, fontWeight: 700 }}>{pct0(s.v)}</div>
            <div style={{ color: C.dim, fontSize: 10, marginTop: 2 }}>{s.lab}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MarginChart({ margin, home, away }: { margin: MarginPoint[]; home: string; away: string }) {
  const max = Math.max(...margin.map((d) => d.prob), 0.0001);
  const sorted = [...margin].sort((a, b) => a.diff - b.diff);
  return (
    <Panel title="Winning margin" hint={`goal difference (${home} − ${away})`}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
        {sorted.map((d) => {
          const col = d.diff > 0 ? C.home : d.diff < 0 ? C.away : C.draw;
          return (
            <div key={d.diff} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${d.diff > 0 ? "+" : ""}${d.diff}: ${pct(d.prob)}`}>
              <div className="font-mono" style={{ fontSize: 9, color: C.faint }}>{d.prob >= 0.01 ? pct0(d.prob) : ""}</div>
              <div className="seg" style={{ width: "100%", height: `${(d.prob / max) * 88}px`, minHeight: 2, background: col, opacity: 0.85, borderRadius: "3px 3px 0 0" }} />
              <div className="font-mono" style={{ fontSize: 10, color: C.dim }}>{d.diff > 0 ? `+${d.diff}` : d.diff}</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Band({ label, ci, max, color }: { label: string; ci: CI; max: number; color: string }) {
  const left = (ci.p05 / max) * 100;
  const width = ((ci.p95 - ci.p05) / max) * 100;
  const mean = (ci.mean / max) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div className="font-mono" style={{ width: 72, color: C.dim, fontSize: 11 }}>{label}</div>
      <div style={{ flex: 1, position: "relative", height: 14, background: C.panel2, borderRadius: 4 }}>
        <div style={{ position: "absolute", left: `${left}%`, width: `${Math.max(width, 0.5)}%`, top: 3, height: 8, background: color, opacity: 0.35, borderRadius: 4 }} />
        <div style={{ position: "absolute", left: `${mean}%`, top: 0, height: 14, width: 2, background: color, transform: "translateX(-1px)" }} />
      </div>
      <div className="font-mono" style={{ width: 116, textAlign: "right", color: C.faint, fontSize: 10 }}>
        {fmt(ci.mean, max)} <span style={{ color: C.dim }}>[{fmt(ci.p05, max)}–{fmt(ci.p95, max)}]</span>
      </div>
    </div>
  );
}

// Probabilities (max ≤ 1) print as %, expected-goals values print as fixed.
const fmt = (v: number, max: number) => (max <= 1 ? pct0(v) : v.toFixed(2));

function UncertaintyPanel({ u, home, away }: { u: Uncertainty; home: string; away: string }) {
  const xgMax = Math.max(u.expected_goals.home.p95, u.expected_goals.away.p95) * 1.1 || 1;
  return (
    <Panel title="Credible intervals" hint="90% posterior band · bar = mean">
      <div className="font-mono" style={{ color: C.faint, fontSize: 10, marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>Outcome</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Band label={home} ci={u.outcome.home_win} max={1} color={C.home} />
        <Band label="Draw" ci={u.outcome.draw} max={1} color={C.draw} />
        <Band label={away} ci={u.outcome.away_win} max={1} color={C.away} />
      </div>
      <div className="font-mono" style={{ color: C.faint, fontSize: 10, margin: "16px 0 8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Expected goals</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Band label={`${home} xG`} ci={u.expected_goals.home} max={xgMax} color={C.home} />
        <Band label={`${away} xG`} ci={u.expected_goals.away} max={xgMax} color={C.away} />
      </div>
    </Panel>
  );
}

/** Renders whichever extras are present on the prediction; nothing if none. */
export default function ExtrasView({ p }: { p: Prediction }) {
  if (!p.markets && !p.margin && !p.uncertainty) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 18 }}>
      {p.markets && <MarketsPanel m={p.markets} />}
      {p.margin && p.margin.length > 0 && <MarginChart margin={p.margin} home={p.home} away={p.away} />}
      {p.uncertainty && <UncertaintyPanel u={p.uncertainty} home={p.home} away={p.away} />}
    </div>
  );
}
