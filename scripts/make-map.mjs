// Precompute the US map as SVG paths (src/generated/us-map.json), so the page ships ~40 KB of paths instead of
// d3 and the 115 KB atlas, and the map is in the server-rendered HTML.
//   node scripts/make-map.mjs
// Source: us-atlas 3.x states-10m.json (US Census Bureau cartographic boundaries; ISC licence). Albers USA
// projection (Alaska and Hawaii inset), fitted to the same 520x310 frame the original canvas map used.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "generated", "us-map.json");
const WIDTH = 520;
const HEIGHT = 310;

const atlas = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", "us-atlas", "states-10m.json"), "utf8"));
const states = feature(atlas, atlas.objects.states).features.filter((state) => Number(state.id) < 60);
const collection = { type: "FeatureCollection", features: states };
const projection = geoAlbersUsa().fitExtent([[16, 14], [WIDTH - 16, HEIGHT - 18]], collection);
const toPath = geoPath(projection).digits(2);

// Snap to whole pixels (the original map was drawn pixelated), drop repeated points, and drop rings that
// collapse to fewer than three points. A state left with no ring (the District of Columbia) is drawn as a
// small square at its centroid by the UI instead.
function simplify(d) {
  const rings = d.split("M").filter(Boolean);
  const kept = [];
  for (const ring of rings) {
    const points = ring.replace(/Z/g, "").split("L").map((pair) => pair.split(",").map((value) => Math.round(Number(value))));
    const clean = [];
    for (const [x, y] of points) {
      const last = clean[clean.length - 1];
      if (!last || last[0] !== x || last[1] !== y) clean.push([x, y]);
    }
    if (clean.length > 1 && clean[0][0] === clean[clean.length - 1][0] && clean[0][1] === clean[clean.length - 1][1]) clean.pop();
    if (clean.length >= 3) kept.push("M" + clean.map(([x, y]) => `${x} ${y}`).join("L") + "Z");
  }
  return kept.join("");
}

const out = states
  .map((state) => {
    const fips = String(state.id).padStart(2, "0");
    const [cx, cy] = geoPath(projection).centroid(state);
    return { fips, d: simplify(toPath(state) || ""), cx: Math.round(cx), cy: Math.round(cy) };
  })
  .sort((a, b) => a.fips.localeCompare(b.fips));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ width: WIDTH, height: HEIGHT, states: out }) + "\n");
console.log(`wrote ${path.relative(ROOT, OUT)}: ${out.length} shapes, ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
