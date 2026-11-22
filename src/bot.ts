// Scripted players. The tests use them to prove the campaign can be won (and lost), and the guide uses them
// to publish how many moves and campaign days a win takes, computed from the live rules.
import {
  FIELD_ACTIONS,
  MANDATES,
  OUTREACH_MOVES,
  actionRateGain,
  buyUpgrade,
  canOutreach,
  canRatify,
  initialState,
  outcomeFor,
  outreach,
  outreachResult,
  purchasableLevels,
  ratify,
  resultFor,
  upgradeCost,
} from "./engine.ts";
import type { OutreachId, ResultSummary, SaveState } from "./engine.ts";

// "planner": ratifies every affordable mandate, buys the upgrade with the most organizers per momentum,
//            and otherwise makes the outreach move with the most momentum per campaign hour.
// "casual":  follows the on-screen missions loosely: takes turns at the three outreach moves, buys the
//            cheapest upgrade it can afford every few moves, and ratifies mandates when it notices them.
// "talker":  only knocks doors and never builds anything. It should lose.
export type Strategy = "planner" | "casual" | "talker";

const T0 = 1_700_000_000_000;

function bestOutreach(state: SaveState): OutreachId {
  let best: OutreachId = "door";
  let bestValue = -1;
  for (const move of OUTREACH_MOVES) {
    if (!canOutreach(state, move.id)) continue;
    const value = outreachResult(state, move.id).momentum / move.hours;
    if (value > bestValue) {
      best = move.id;
      bestValue = value;
    }
  }
  return best;
}

function plannerMove(state: SaveState): SaveState {
  for (const mandate of MANDATES) if (canRatify(state, mandate.id)) return ratify(state, mandate.id, T0);
  let bestId = "";
  let bestValue = 0;
  for (const action of FIELD_ACTIONS) {
    if (purchasableLevels(state, action, "one") < 1) continue;
    const level = state.upgrades[action.id] || 0;
    // The story camera kit changes how door knocks work, so the planner takes its first level early.
    const value = action.id === "receipts" && level === 0 ? Infinity : actionRateGain(action, level) / upgradeCost(action, level);
    if (value > bestValue) {
      bestId = action.id;
      bestValue = value;
    }
  }
  if (bestId) return buyUpgrade(state, bestId, "one", T0);
  return outreach(state, bestOutreach(state), T0);
}

function casualMove(state: SaveState): SaveState {
  if (state.moves % 4 === 3) {
    for (const mandate of MANDATES) if (canRatify(state, mandate.id)) return ratify(state, mandate.id, T0);
    const cheapest = FIELD_ACTIONS.filter((action) => purchasableLevels(state, action, "one") > 0).sort(
      (a, b) => upgradeCost(a, state.upgrades[a.id] || 0) - upgradeCost(b, state.upgrades[b.id] || 0),
    )[0];
    if (cheapest) return buyUpgrade(state, cheapest.id, "one", T0);
  }
  const order: OutreachId[] = ["door", "story", "dm"];
  return outreach(state, order[state.moves % 3], T0);
}

export type RunResult = ResultSummary & { states: SaveState };

export function simulateCampaign(strategy: Strategy, maxMoves = 20_000): RunResult {
  let state = initialState(T0);
  for (let move = 0; move < maxMoves && outcomeFor(state) === "playing"; move += 1) {
    const next = strategy === "planner" ? plannerMove(state) : strategy === "casual" ? casualMove(state) : outreach(state, "door", T0);
    if (next === state) break;
    state = next;
  }
  return { ...resultFor(state), states: state };
}
