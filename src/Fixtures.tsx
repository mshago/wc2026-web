// Schedule-driven Fixtures tab. Reads the bracket from the schedule API
// (GET /fixtures), maps team names onto the prediction API's canonical names,
// and shows a grouped, scannable list. Selecting a match loads the full forecast
// below (reusing MatchCard + ModelCompare), firing only one /predict+/compare at
// a time. Falls back to the embedded snapshot if the schedule is unreachable.
import React, { useEffect, useMemo, useState } from "react";
import predictionsData from "./data/predictions.json";
import type { Prediction, ScheduleMatch, ScheduleResponse, Stage } from "./types";
import { C } from "./theme";
import { fetchSchedule, fetchTeams, fetchHealth, fetchPredict } from "./api";
import { resolveTeam } from "./teamMap";
import MatchCard from "./MatchCard";
import ModelCompare from "./Compare";

const DEMO_PREDICTIONS = predictionsData as Prediction[];

const cardStyle: React.CSSProperties = {
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20,
};
const selectStyle: React.CSSProperties = {
  background: C.panel2, border: `1px solid ${C.line}`, color: C.ink, borderRadius: 8,
  padding: "10px 11px", fontSize: 13, width: "100%",
};

const STAGE_ORDER: Stage[] = [
  "GROUP_STAGE", "LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL",
];
const STAGE_LABEL: Record<Stage, string> = {
  GROUP_STAGE: "Group stage", LAST_32: "Round of 32", LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-finals", SEMI_FINALS: "Semi-finals", THIRD_PLACE: "Third place", FINAL: "Final",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** Schedule team name → display name (canonical when resolvable, else raw, else TBD). */
const display = (name: string | null, canonical: ReadonlySet<string>) =>
  name ? (resolveTeam(name, canonical) ?? name) : "TBD";

/** Build a minimal schedule from the embedded snapshot when /fixtures is down. */
function embeddedSchedule(): ScheduleMatch[] {
  return DEMO_PREDICTIONS.map((p, i) => ({
    id: -1 - i,
    utc_date: `${p.date ?? "2026-06-11"}T00:00:00Z`,
    status: "TIMED",
    stage: "GROUP_STAGE",
    group: null,
    home: p.home, away: p.away,
    home_known: true, away_known: true,
    venue: null, venue_country: null,
    neutral: p.neutral, played: false, result: null,
  }));
}

// ---- detail: full forecast for the selected match ----

function MatchDetail(
  { apiUrl, match, canonical, version }: { apiUrl: string; match: ScheduleMatch; canonical: ReadonlySet<string>; version: string | null },
) {
  const home = resolveTeam(match.home, canonical);
  const away = resolveTeam(match.away, canonical);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [source, setSource] = useState<"live" | "cached">("live");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!home || !away) return; // unresolved/TBD — nothing to fetch
    let cancelled = false;
    (async () => {
      setBusy(true); setError(null); setPred(null);
      try {
        const live = await fetchPredict(apiUrl, home, away, match.neutral, {
          venue: match.venue_country || undefined, // host nation, when known
          version,
        });
        if (!cancelled) { setPred({ ...live, date: fmtDate(match.utc_date) }); setSource("live"); }
      } catch (e) {
        // Try the embedded snapshot for this exact pairing before giving up.
        const snap = DEMO_PREDICTIONS.find((d) => d.home === home && d.away === away);
        if (cancelled) return;
        if (snap) { setPred(snap); setSource("cached"); }
        else setError(`Forecast unavailable (${e instanceof Error ? e.message : String(e)}).`);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiUrl, home, away, match.neutral, match.venue_country, match.utc_date, version]);

  if (!home || !away) {
    const tbd = match.home === null || match.away === null;
    return (
      <div style={{ ...cardStyle, color: C.dim, fontSize: 13 }} className="font-mono card-fade">
        {tbd
          ? "This matchup isn't set yet — it resolves as the bracket fills in."
          : "Forecast unavailable: a team here isn't recognised by the prediction model."}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} className="card-fade">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div className="font-mono" style={{ color: C.faint, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {STAGE_LABEL[match.stage]}{match.group ? ` · ${match.group.replace("_", " ")}` : ""}
          {` · ${fmtDate(match.utc_date)} ${fmtTime(match.utc_date)}`}
          {match.played && match.result ? <span style={{ color: C.win }}> · Final {match.result.home}–{match.result.away}</span> : null}
        </div>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: busy ? C.warn : source === "live" ? C.win : C.warn, border: `1px solid ${C.line}`, borderRadius: 99, padding: "4px 10px" }}>
          {busy ? "Fetching…" : source === "live" ? "● Live API" : "● Cached snapshot"}
        </div>
      </div>

      {busy && <div className="font-mono" style={{ color: C.dim, fontSize: 13, padding: 8 }}>Loading forecast…</div>}
      {error && <div style={{ fontSize: 13, color: C.warn, padding: 8 }}>{error}</div>}
      {pred && <MatchCard p={pred} />}
      {pred && <ModelCompare apiUrl={apiUrl} home={home} away={away} version={version} />}
    </div>
  );
}

/** One-line label for a match in the picker. */
function optionLabel(m: ScheduleMatch, canonical: ReadonlySet<string>) {
  const h = display(m.home, canonical), a = display(m.away, canonical);
  const score = m.played && m.result ? `  (FT ${m.result.home}–${m.result.away})` : "";
  return `${fmtDate(m.utc_date)} · ${h} v ${a}${score}`;
}

// ---- the tab ----

export default function Fixtures({ apiUrl }: { apiUrl: string }) {
  const [fixtures, setFixtures] = useState<ScheduleMatch[] | null>(null);
  const [canonical, setCanonical] = useState<ReadonlySet<string>>(new Set());
  const [version, setVersion] = useState<string | null>(null);
  const [source, setSource] = useState<"live" | "cached">("live");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true); setError(null);
      // Teams + health are best-effort: without /teams nothing resolves (forecasts
      // hide gracefully); without health we just don't have a cache version.
      const [teamsRes, healthRes] = await Promise.allSettled([fetchTeams(apiUrl), fetchHealth(apiUrl)]);
      if (cancelled) return;
      if (teamsRes.status === "fulfilled") setCanonical(new Set(teamsRes.value.teams));
      setVersion(healthRes.status === "fulfilled" ? healthRes.value.model_version : null);

      try {
        const sched: ScheduleResponse = await fetchSchedule(apiUrl);
        if (cancelled) return;
        setFixtures(sched.fixtures); setSource("live");
      } catch {
        if (cancelled) return;
        setFixtures(embeddedSchedule()); setSource("cached");
        setError("Schedule unreachable — showing the embedded group-stage snapshot.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiUrl]);

  // Group by stage (ordered), each sorted by kickoff.
  const groups = useMemo(() => {
    const all = fixtures ?? [];
    return STAGE_ORDER
      .map((stage) => ({
        stage,
        matches: all.filter((m) => m.stage === stage).sort((x, y) => x.utc_date.localeCompare(y.utc_date)),
      }))
      .filter((g) => g.matches.length > 0);
  }, [fixtures]);

  // Default selection: the next unplayed match, else the first.
  useEffect(() => {
    if (selectedId !== null || !fixtures || fixtures.length === 0) return;
    const next = [...fixtures].sort((a, b) => a.utc_date.localeCompare(b.utc_date)).find((m) => !m.played);
    setSelectedId((next ?? fixtures[0]).id);
  }, [fixtures, selectedId]);

  const selected = fixtures?.find((m) => m.id === selectedId) ?? null;

  if (busy && !fixtures) return <div className="font-mono" style={{ color: C.dim, fontSize: 13, padding: 8 }}>Loading fixtures…</div>;
  if (!fixtures || fixtures.length === 0) {
    return <div className="font-mono" style={{ color: C.dim, fontSize: 13, padding: 8 }}>{error ?? "No fixtures available."}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {error && <div style={{ fontSize: 12, color: C.warn }}>{error}</div>}

      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
          <div className="font-display panel-title">Tournament schedule</div>
          <div className="font-mono" style={{ color: C.faint, fontSize: 10 }}>
            {fixtures.length} matches · {source === "live" ? "live schedule" : "cached"}
          </div>
        </div>
        <label className="font-mono" style={{ color: C.faint, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Pick a match</label>
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          style={{ ...selectStyle, marginTop: 6 }}
        >
          {groups.map((g) => (
            <optgroup key={g.stage} label={`${STAGE_LABEL[g.stage]} (${g.matches.length})`}>
              {g.matches.map((m) => (
                <option key={m.id} value={m.id}>{optionLabel(m, canonical)}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {selected && <MatchDetail apiUrl={apiUrl} match={selected} canonical={canonical} version={version} />}
    </div>
  );
}
