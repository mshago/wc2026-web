// Team Ratings page — consumes GET /ratings. Self-contained: owns its fetch,
// loading and error state, and falls back to a friendly message (there is no
// embedded ratings snapshot, so this view requires the live API).
import React, { useEffect, useMemo, useState } from "react";
import { C } from "./theme";
import { fetchRatings } from "./api";
import type { TeamRating } from "./types";

const cardStyle: React.CSSProperties = {
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20,
};

// Maps a data range onto a pixel range for the scatter axes.
function scaler(min: number, max: number, lo: number, hi: number) {
  const span = max - min || 1;
  return (v: number) => lo + ((v - min) / span) * (hi - lo);
}

function Scatter({ teams }: { teams: TeamRating[] }) {
  const W = 440, H = 320, pad = 38;
  const { sx, sy, labelled } = useMemo(() => {
    const ax = teams.flatMap((t) => [t.attack.p05, t.attack.p95]);
    const dy = teams.flatMap((t) => [t.defense.p05, t.defense.p95]);
    const sx = scaler(Math.min(...ax), Math.max(...ax), pad, W - pad);
    const sy = scaler(Math.min(...dy), Math.max(...dy), H - pad, pad); // invert: up = stronger
    const labelled = new Set(teams.slice(0, 12).map((t) => t.team));
    return { sx, sy, labelled };
  }, [teams]);

  return (
    <div style={cardStyle}>
      <div className="font-display panel-title">Attack vs defense</div>
      <div className="font-mono" style={{ color: C.faint, fontSize: 10, marginBottom: 14 }}>
        each team's strength · whiskers show the 90% credible interval
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Attack versus defense scatter plot" style={{ overflow: "visible" }}>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={C.line} />
        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke={C.line} />
        <text x={(W) / 2} y={H - 6} textAnchor="middle" fill={C.faint} fontSize="10" fontFamily="Space Mono, monospace">attack →</text>
        <text x={12} y={H / 2} textAnchor="middle" fill={C.faint} fontSize="10" fontFamily="Space Mono, monospace" transform={`rotate(-90 12 ${H / 2})`}>defense →</text>
        {teams.map((t, i) => {
          const cx = sx(t.attack.mean), cy = sy(t.defense.mean);
          const top = labelled.has(t.team);
          const col = i === 0 ? C.win : top ? C.home : C.dim;
          return (
            <g key={t.team}>
              <line x1={sx(t.attack.p05)} y1={cy} x2={sx(t.attack.p95)} y2={cy} stroke={col} strokeOpacity={0.25} />
              <line x1={cx} y1={sy(t.defense.p05)} x2={cx} y2={sy(t.defense.p95)} stroke={col} strokeOpacity={0.25} />
              <circle cx={cx} cy={cy} r={top ? 4 : 2.5} fill={col} fillOpacity={top ? 0.95 : 0.5} />
              {top && (
                <text x={cx + 6} y={cy - 5} fill={C.ink} fontSize="9" fontFamily="Space Mono, monospace">{t.team}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Table({ teams }: { teams: TeamRating[] }) {
  return (
    <div style={cardStyle}>
      <div className="font-display panel-title">Strength ranking</div>
      <div className="font-mono" style={{ color: C.faint, fontSize: 10, marginBottom: 14 }}>ranked by overall rating · {teams.length} teams</div>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.faint, textAlign: "left" }} className="font-mono">
              <th style={{ padding: "4px 6px", position: "sticky", top: 0, background: C.panel }}>#</th>
              <th style={{ padding: "4px 6px", position: "sticky", top: 0, background: C.panel }}>Team</th>
              <th style={{ padding: "4px 6px", textAlign: "right", position: "sticky", top: 0, background: C.panel }}>Rating</th>
              <th style={{ padding: "4px 6px", textAlign: "right", position: "sticky", top: 0, background: C.panel }}>Atk</th>
              <th style={{ padding: "4px 6px", textAlign: "right", position: "sticky", top: 0, background: C.panel }}>Def</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.team} style={{ borderTop: `1px solid ${C.line}`, color: C.ink }}>
                <td className="font-mono" style={{ padding: "5px 6px", color: i === 0 ? C.win : C.dim }}>{i + 1}</td>
                <td style={{ padding: "5px 6px" }}>{t.team}</td>
                <td className="font-mono" style={{ padding: "5px 6px", textAlign: "right" }}>{t.rating.toFixed(2)}</td>
                <td className="font-mono" style={{ padding: "5px 6px", textAlign: "right", color: C.home }}>{t.attack.mean.toFixed(2)}</td>
                <td className="font-mono" style={{ padding: "5px 6px", textAlign: "right", color: C.away }}>{t.defense.mean.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Ratings({ apiUrl }: { apiUrl: string }) {
  const [teams, setTeams] = useState<TeamRating[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true); setError(null);
      try {
        const r = await fetchRatings(apiUrl);
        if (cancelled) return;
        setTeams([...r.teams].sort((a, b) => b.rating - a.rating));
      } catch (e) {
        if (cancelled) return;
        setError(`Couldn't load ratings (${e instanceof Error ? e.message : String(e)}). This page needs the live API.`);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiUrl]);

  if (busy) return <div className="font-mono" style={{ color: C.dim, fontSize: 13, padding: 8 }}>Loading ratings…</div>;
  if (error) return <div style={{ fontSize: 13, color: C.warn, padding: 8 }}>{error}</div>;
  if (!teams || teams.length === 0) return <div className="font-mono" style={{ color: C.dim, fontSize: 13, padding: 8 }}>No ratings available.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Scatter teams={teams} />
      <Table teams={teams} />
    </div>
  );
}
