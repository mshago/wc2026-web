import { useState } from "react";
import teamsData from "./data/teams.json";
import type { Prediction } from "./types";
import { C } from "./theme";
import { fetchPredict, type ExtraKey } from "./api";
import ExtrasView from "./Extras";
import Ratings from "./Ratings";
import ModelCompare, { Scoreboard } from "./Compare";
import MatchCard from "./MatchCard";
import Fixtures from "./Fixtures";

const ALL_TEAMS = teamsData as string[];

// API base URL comes from a build-time env var. It is PUBLIC (baked into the
// bundle) — fine for a public API URL, never for secrets. See .env.example.
const DEPLOYED_API = import.meta.env.VITE_API_URL || "";

// Extras the "Any matchup" tab can request. Kept opt-in so default payloads
// stay small (the API only includes these sections when asked).
const EXTRA_OPTIONS: { key: ExtraKey; label: string }[] = [
  { key: "markets", label: "Markets" },
  { key: "margin", label: "Margin" },
  { key: "uncertainty", label: "Uncertainty" },
];

export default function App() {
  const [page, setPage] = useState<"predict" | "ratings" | "scoreboard">("predict");
  // "fixtures" = schedule-driven bracket (self-contained); "live" = pick any pair.
  const [tab, setTab] = useState<"fixtures" | "live">("fixtures");
  const [apiUrl, setApiUrl] = useState(DEPLOYED_API);

  // "Any matchup" tab state. The fixtures tab owns its own fetch/loading state.
  const [result, setResult] = useState<Prediction | undefined>(undefined);
  const [source, setSource] = useState<"live" | "cached">("live");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const [teams] = useState(ALL_TEAMS);
  const [home, setHome] = useState("Mexico");
  const [away, setAway] = useState("South Korea");
  const [neutral, setNeutral] = useState(false);
  // venue (host country) overrides neutral when set; "" = none. Sourced from the
  // same team list — never hard-coded.
  const [venue, setVenue] = useState("");
  const [extras, setExtras] = useState<ExtraKey[]>([]);

  const toggleExtra = (k: ExtraKey) =>
    setExtras((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  async function predictLive() {
    setBusy(true); setStatus(null);
    try {
      const r = await fetchPredict(apiUrl, home, away, neutral, { venue: venue || null, extras });
      setResult(r); setSource("live");
    } catch (e) {
      setStatus({ ok: false, msg: `Prediction failed (${e instanceof Error ? e.message : String(e)}). Check the URL, that the model deployed, and that CORS is open.` });
    } finally { setBusy(false); }
  }

  const inputStyle = { background: C.panel2, border: `1px solid ${C.line}`, color: C.ink, borderRadius: 8, padding: "9px 11px", fontSize: 13, width: "100%" };
  const badge = busy
    ? { t: "Fetching…", c: C.warn }
    : source === "live"
    ? { t: "● Live API", c: C.win }
    : { t: "● Cached snapshot", c: C.warn };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink, padding: "28px 18px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        html, body { margin: 0; background: ${C.bg}; }
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .font-mono { font-family: 'Space Mono', ui-monospace, monospace; }
        body, button, select, input { font-family: 'Inter', system-ui, sans-serif; }
        .wrap { max-width: 920px; margin: 0 auto; }
        .team-name { font-weight: 700; font-size: 26px; line-height: 1.05; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .score-big { font-size: 52px; font-weight: 700; line-height: 1; }
        .panel-title { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
        .axis-label { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
        .cell-tick { font-size: 10px; text-align: center; }
        .heat-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 11px; transition: transform .12s ease; cursor: default; }
        .heat-cell:hover { transform: scale(1.12); z-index: 2; }
        .grid-2 { display: grid; grid-template-columns: 1.15fr 1fr; gap: 18px; }
        .matchup-grid { display: grid; grid-template-columns: 1fr 1fr auto auto; gap: 8px; align-items: end; }
        .seg { transition: width .5s cubic-bezier(.4,0,.2,1); }
        .card-fade { animation: fade .35s ease; }
        @keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .tab-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all .15s ease; }
        select:focus, input:focus, button:focus-visible { outline: 2px solid ${C.home}; outline-offset: 1px; }
        @media (max-width: 680px) { .grid-2 { grid-template-columns: 1fr; } .matchup-grid { grid-template-columns: 1fr 1fr; } .score-big { font-size: 40px; } .team-name { font-size: 20px; } }
        @media (prefers-reduced-motion: reduce) { .seg, .heat-cell, .card-fade { transition: none; animation: none; } }
      `}</style>

      <div className="wrap">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          <div>
            <div className="font-display" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
              WC<span style={{ color: C.home }}>26</span> Match Model
            </div>
            <div className="font-mono" style={{ color: C.faint, fontSize: 11, letterSpacing: "0.06em", marginTop: 3 }}>
              bayesian poisson · dixon-coles · posterior-predictive scorelines
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="tab-btn" onClick={() => setPage("predict")} style={{ background: page === "predict" ? C.home : C.panel2, color: page === "predict" ? "#001233" : C.dim }}>Predictions</button>
              <button className="tab-btn" onClick={() => setPage("ratings")} style={{ background: page === "ratings" ? C.home : C.panel2, color: page === "ratings" ? "#001233" : C.dim }}>Team ratings</button>
              <button className="tab-btn" onClick={() => setPage("scoreboard")} style={{ background: page === "scoreboard" ? C.home : C.panel2, color: page === "scoreboard" ? "#001233" : C.dim }}>Model scoreboard</button>
            </div>
            {page === "predict" && tab === "live" && (result || busy) && (
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: badge.c, border: `1px solid ${C.line}`, borderRadius: 99, padding: "5px 11px" }}>
                {badge.t}
              </div>
            )}
          </div>
        </div>

        {page === "ratings" ? (
          <Ratings apiUrl={apiUrl} />
        ) : page === "scoreboard" ? (
          <Scoreboard apiUrl={apiUrl} />
        ) : (
        <>
        <div className="rounded-2xl" style={{ background: C.panel, border: `1px solid ${C.line}`, padding: 16, marginBottom: 22 }}>
          {/* Dev-only API URL override. Hidden in production: VITE_API_URL is the
              source of truth there, and CSP connect-src is pinned to that origin. */}
          {import.meta.env.DEV && (
            <div style={{ marginBottom: 14 }}>
              <label className="font-mono" style={{ color: C.faint, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>API URL</label>
              <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://your-app.up.railway.app" style={{ ...inputStyle, marginTop: 6 }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: tab === "live" ? 14 : 0 }}>
            <button className="tab-btn" onClick={() => setTab("fixtures")} style={{ background: tab === "fixtures" ? C.home : C.panel2, color: tab === "fixtures" ? "#001233" : C.dim }}>Fixtures</button>
            <button className="tab-btn" onClick={() => setTab("live")} style={{ background: tab === "live" ? C.home : C.panel2, color: tab === "live" ? "#001233" : C.dim }}>Any matchup</button>
          </div>

          {tab === "live" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="matchup-grid">
                <div>
                  <label className="font-mono" style={{ color: C.home, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Home</label>
                  <select value={home} onChange={(e) => setHome(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>{teams.map((t) => <option key={t}>{t}</option>)}</select>
                </div>
                <div>
                  <label className="font-mono" style={{ color: C.away, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Away</label>
                  <select value={away} onChange={(e) => setAway(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>{teams.map((t) => <option key={t}>{t}</option>)}</select>
                </div>
                <label title={venue ? "Overridden by the selected venue" : undefined} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.dim, height: 38, opacity: venue ? 0.4 : 1 }}>
                  <input type="checkbox" checked={neutral} disabled={!!venue} onChange={(e) => setNeutral(e.target.checked)} /> Neutral
                </label>
                <button className="tab-btn" disabled={busy} onClick={predictLive} style={{ background: C.win, color: "#00231a", height: 38 }}>{busy ? "…" : "Predict"}</button>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <label className="font-mono" style={{ color: C.faint, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Venue (optional)</label>
                  <select value={venue} onChange={(e) => setVenue(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>
                    <option value="">No venue — use neutral flag</option>
                    {teams.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: "1 1 220px" }}>
                  <label className="font-mono" style={{ color: C.faint, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Extras</label>
                  <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                    {EXTRA_OPTIONS.map((o) => (
                      <label key={o.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.dim }}>
                        <input type="checkbox" checked={extras.includes(o.key)} onChange={() => toggleExtra(o.key)} /> {o.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {venue && (
                <div className="font-mono" style={{ fontSize: 10, color: C.faint }}>
                  venue overrides the neutral flag · crowd support derived from {venue}
                </div>
              )}
              {status && <div style={{ fontSize: 12, color: status.ok ? C.win : C.warn, marginTop: 4 }}>{status.msg}</div>}
            </div>
          )}
        </div>

        {tab === "fixtures" ? (
          <Fixtures apiUrl={apiUrl} />
        ) : (
          <>
            {result ? (
              <>
                <MatchCard p={result} />
                <ModelCompare apiUrl={apiUrl} home={result.home} away={result.away} />
                <ExtrasView p={result} />
              </>
            ) : (
              <div className="font-mono" style={{ color: C.dim, fontSize: 13, padding: 8 }}>
                Pick two teams and hit Predict to see the forecast.
              </div>
            )}
          </>
        )}

        <div className="font-mono" style={{ color: C.faint, fontSize: 10, textAlign: "center", marginTop: 26, lineHeight: 1.7 }}>
          probabilities are posterior-predictive over 1,500 draws · home advantage off at neutral venues<br />
          model trained on international results since 2021 with time-decay weighting
        </div>
        </>
        )}
      </div>
    </div>
  );
}
