// Shared design tokens + pure formatting/color helpers. Kept dependency-free so
// any view (App, Extras, Ratings) can import them. No JSX here.

// ---------- palette ----------
export const C = {
  bg: "#0A111E", panel: "#111C2E", panel2: "#0E1726", line: "#22304A",
  ink: "#EAF0FA", dim: "#8595B4", faint: "#5C6B89",
  home: "#4F8DFF", away: "#FF5C72", draw: "#7C8AAB", win: "#34D399", warn: "#F2B544",
};

// ---------- heat-map color ramp ----------
const STOPS: [number, [number, number, number]][] = [
  [0.0, [14, 23, 38]], [0.32, [34, 70, 138]], [0.58, [122, 46, 160]],
  [0.8, [214, 52, 110]], [1.0, [255, 142, 61]],
];
export function heat(t: number): string {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i];
      const f = (t - t0) / (t1 - t0 || 1);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(255,142,61)";
}

// ---------- formatters ----------
export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const pct0 = (x: number) => `${Math.round(x * 100)}%`;
export const outcomeColor = (h: number, a: number) => (h > a ? C.home : a > h ? C.away : C.draw);
export const apiBase = (u: string) => u.trim().replace(/\/$/, "");
