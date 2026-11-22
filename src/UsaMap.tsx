import mapData from "./generated/us-map.json";
import { STATES } from "./states.ts";
import type { MapProgress } from "./engine.ts";

type MapShape = { fips: string; d: string; cx: number; cy: number };
export const MAP = mapData as { width: number; height: number; states: MapShape[] };
const NAMES = new Map(STATES.map((state) => [state.fips, state]));

// The electoral map as server-renderable SVG. Organized states are gold; the state the organizers are
// working on next glows in proportion to its progress.
export default function UsaMap({ progress }: { progress: MapProgress }) {
  const organized = new Set(progress.organized.map((state) => state.fips));
  const nextFips = progress.next?.fips;
  return (
    <svg
      className="usa-map"
      viewBox={`0 0 ${MAP.width} ${MAP.height}`}
      role="img"
      aria-label={`Map of the United States: ${progress.organized.length} of 51 organized, ${progress.electoralVotes} electoral votes${progress.next ? `. Next: ${progress.next.name}, ${Math.round(progress.nextProgress * 100)}% organized` : ""}`}
      data-testid="usa-map"
    >
      {MAP.states.map((shape) => {
        const info = NAMES.get(shape.fips);
        const isOrganized = organized.has(shape.fips);
        const isNext = shape.fips === nextFips;
        const className = isOrganized ? "state organized" : isNext ? "state next" : "state";
        const label = `${info?.name ?? shape.fips}: ${info?.ev ?? 0} electoral votes, ${isOrganized ? "organized" : isNext ? `${Math.round(progress.nextProgress * 100)}% organized` : "not reached"}`;
        return (
          <g key={shape.fips} className={className} data-fips={shape.fips}>
            <title>{label}</title>
            {shape.d ? (
              <path d={shape.d} style={isNext ? { fillOpacity: 0.35 + progress.nextProgress * 0.65 } : undefined} />
            ) : (
              <rect x={shape.cx - 3} y={shape.cy - 3} width={6} height={6} />
            )}
            {isOrganized && <rect className="state-dot" x={shape.cx - 2} y={shape.cy - 2} width={4} height={4} />}
          </g>
        );
      })}
    </svg>
  );
}
