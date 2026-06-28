// Maps SCHEDULE API team names onto the PREDICTION API's canonical /teams names.
//
// The prediction API is case- and accent-sensitive and rejects any name not in
// /teams exactly. The schedule API mostly already uses the canonical spellings,
// but a few differ. Keep this lookup small and explicit; resolveTeam() falls
// back to null for anything unresolved so callers can SKIP the prediction
// rather than fire a request that 404s.

/**
 * Known schedule → canonical spelling differences. Only entries whose target
 * actually exists in /teams take effect (resolveTeam verifies membership), so
 * defensive extras are harmless if the prediction API never uses them.
 */
export const NAME_MAP: Record<string, string> = {
  // Observed live in GET /fixtures:
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "Cape Verde Islands": "Cape Verde",
  // Defensive — common alternate spellings other feeds use:
  "Korea Republic": "South Korea",
  "Korea DPR": "North Korea",
  USA: "United States",
  "IR Iran": "Iran",
  "Czechia": "Czech Republic",
};

/**
 * Resolve a schedule-API team name to its canonical prediction-API name.
 * Returns null when the name is missing (undetermined slot) or cannot be
 * resolved to a name the model knows — callers should then hide the forecast
 * for that fixture instead of querying the API.
 *
 * @param name      raw name from the schedule API (may be null)
 * @param canonical the set of names from GET /teams
 */
export function resolveTeam(
  name: string | null | undefined,
  canonical: ReadonlySet<string>,
): string | null {
  if (!name) return null;
  if (canonical.has(name)) return name;
  const mapped = NAME_MAP[name];
  if (mapped && canonical.has(mapped)) return mapped;
  return null;
}
