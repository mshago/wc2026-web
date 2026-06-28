import { describe, it, expect } from "vitest";
import { resolveTeam, NAME_MAP } from "./teamMap";

// A stand-in for GET /teams: the canonical names the model knows.
const CANON = new Set([
  "Mexico",
  "South Korea",
  "United States",
  "Iran",
  "Bosnia and Herzegovina",
  "Cape Verde",
  "Côte d'Ivoire",
  "Ivory Coast",
]);

describe("resolveTeam", () => {
  it("passes through names that are already canonical", () => {
    expect(resolveTeam("Mexico", CANON)).toBe("Mexico");
    expect(resolveTeam("South Korea", CANON)).toBe("South Korea");
  });

  it("maps the real schedule-API mismatches seen in GET /fixtures", () => {
    expect(resolveTeam("Bosnia-Herzegovina", CANON)).toBe("Bosnia and Herzegovina");
    expect(resolveTeam("Cape Verde Islands", CANON)).toBe("Cape Verde");
  });

  it("maps common alternate spellings from other feeds", () => {
    expect(resolveTeam("Korea Republic", CANON)).toBe("South Korea");
    expect(resolveTeam("USA", CANON)).toBe("United States");
    expect(resolveTeam("IR Iran", CANON)).toBe("Iran");
  });

  it("returns null for undetermined slots (null/empty)", () => {
    expect(resolveTeam(null, CANON)).toBeNull();
    expect(resolveTeam(undefined, CANON)).toBeNull();
    expect(resolveTeam("", CANON)).toBeNull();
  });

  it("returns null for names it cannot resolve, so callers skip the request", () => {
    expect(resolveTeam("Atlantis", CANON)).toBeNull();
  });

  it("returns null when a mapped target is absent from /teams", () => {
    // "Czechia" maps to "Czech Republic", which this canonical set lacks.
    expect(NAME_MAP["Czechia"]).toBe("Czech Republic");
    expect(resolveTeam("Czechia", CANON)).toBeNull();
  });
});
