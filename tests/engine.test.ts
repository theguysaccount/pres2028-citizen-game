// Unit tests for the campaign rules. Expected values come from the game data and the real electoral-vote
// table, never from launch-day numbers, so a rebalance only fails a test when it breaks something players rely on.
import assert from "node:assert/strict";
import test from "node:test";
import mapData from "../src/generated/us-map.json" with { type: "json" };
import {
  CAMPAIGN_DAYS,
  ELECTION_HOURS,
  ELECTORAL_VOTES_TO_WIN,
  FIELD_ACTIONS,
  MANDATES,
  MANDATE_HOURS,
  OUTREACH_MOVES,
  ORGANIZERS_TO_WIN,
  STATES,
  STATE_ORDER,
  STORAGE_KEY,
  TIMELINE,
  TOTAL_ELECTORAL_VOTES,
  UPGRADE_COST_GROWTH,
  buyUpgrade,
  campaignDayFor,
  canRatify,
  decodeSave,
  encodeSave,
  formatCampaignClock,
  initialState,
  mapProgressFor,
  maxAffordablePurchases,
  organizersToHold,
  outcomeFor,
  outreach,
  outreachResult,
  parseChallengeDay,
  purchasableLevels,
  ratify,
  rateForState,
  resultFor,
  sanitizeSave,
  upgradeBatchCost,
  upgradeCost,
  upgradeTimeCost,
} from "../src/engine.ts";
import type { SaveState } from "../src/engine.ts";
import { simulateCampaign } from "../src/bot.ts";

const T0 = 1_700_000_000_000;

function funded(state: SaveState, momentum: number): SaveState {
  return { ...state, momentum, totalMomentum: Math.max(state.totalMomentum, momentum) };
}

test("the electoral table is the real one: 51 entries, 538 votes, 270 to win", () => {
  assert.equal(STATES.length, 51);
  assert.equal(STATES.reduce((sum, state) => sum + state.ev, 0), TOTAL_ELECTORAL_VOTES);
  assert.equal(TOTAL_ELECTORAL_VOTES, 538);
  assert.equal(ELECTORAL_VOTES_TO_WIN, Math.floor(TOTAL_ELECTORAL_VOTES / 2) + 1);
  assert.equal(new Set(STATES.map((state) => state.fips)).size, 51);
  assert.equal(new Set(STATES.map((state) => state.abbr)).size, 51);
  for (const state of STATES) assert.ok(state.ev >= 3, `${state.name} has at least 3 votes`);
  assert.equal(STATES.find((state) => state.abbr === "DC")?.ev, 3);
});

test("the map has one shape for every entry in the table", () => {
  const shapes = (mapData as { states: { fips: string; d: string }[] }).states;
  assert.deepEqual(shapes.map((shape) => shape.fips).sort(), STATES.map((state) => state.fips).sort());
  for (const shape of shapes) assert.match(shape.d, /^M[\d -]+(L[\d -]+)+Z/, `shape ${shape.fips} is a closed path`);
});

test("the campaign reaches states smallest first, and every vote counts once", () => {
  for (let index = 1; index < STATE_ORDER.length; index += 1) assert.ok(STATE_ORDER[index].ev >= STATE_ORDER[index - 1].ev);
  const all = mapProgressFor(Number.MAX_SAFE_INTEGER);
  assert.equal(all.organized.length, 51);
  assert.equal(all.electoralVotes, TOTAL_ELECTORAL_VOTES);
  assert.equal(all.next, null);
  const none = mapProgressFor(0);
  assert.equal(none.electoralVotes, 0);
  assert.equal(none.next?.fips, STATE_ORDER[0].fips);
});

test("each new state needs more organizers per vote than the last", () => {
  let votes = 0;
  let lastPerVote = 0;
  for (const state of STATE_ORDER) {
    const perVote = (organizersToHold(votes + state.ev) - organizersToHold(votes)) / state.ev;
    assert.ok(perVote >= lastPerVote - 1, `${state.name} is no cheaper per vote than the state before`);
    lastPerVote = perVote;
    votes += state.ev;
  }
  const atWin = mapProgressFor(ORGANIZERS_TO_WIN);
  assert.ok(atWin.electoralVotes >= ELECTORAL_VOTES_TO_WIN, "the advertised organizer count wins");
  assert.ok(mapProgressFor(ORGANIZERS_TO_WIN - 1).electoralVotes < ELECTORAL_VOTES_TO_WIN, "one fewer does not");
});

test("partial progress toward the next state stays between 0 and 1", () => {
  for (const organizers of [0, 1, 50, ORGANIZERS_TO_WIN / 3, ORGANIZERS_TO_WIN, ORGANIZERS_TO_WIN * 5]) {
    const progress = mapProgressFor(organizers);
    assert.ok(progress.nextProgress >= 0 && progress.nextProgress <= 1);
    assert.ok(progress.nextNeeds >= organizers || progress.next === null);
  }
});

test("upgrade prices, batches and build times follow the stated rules", () => {
  for (const action of FIELD_ACTIONS) {
    assert.equal(upgradeCost(action, 0), Math.floor(action.baseCost));
    assert.ok(upgradeCost(action, 3) <= action.baseCost * UPGRADE_COST_GROWTH ** 3);
    assert.equal(upgradeBatchCost(action, 2, 3), upgradeCost(action, 2) + upgradeCost(action, 3) + upgradeCost(action, 4));
    const plan = maxAffordablePurchases(action, 1, action.baseCost * 40);
    assert.equal(plan.cost, upgradeBatchCost(action, 1, plan.quantity));
    assert.ok(plan.cost <= action.baseCost * 40);
  }
  assert.equal(upgradeTimeCost(0, 1), 36);
  assert.ok(upgradeTimeCost(5, 1) > upgradeTimeCost(4, 1));
  assert.equal(upgradeTimeCost(2, 3), 3 * upgradeTimeCost(2, 1));
});

test("an outreach move costs its hours and earns reach and momentum", () => {
  const start = initialState(T0);
  for (const move of OUTREACH_MOVES) {
    const next = outreach(start, move.id, T0);
    assert.equal(next.campaignHours, move.hours);
    assert.equal(next.moves, 1);
    assert.ok(next.reach > 0 && next.momentum > 0);
    assert.ok(Math.abs(next.momentum - outreachResult(start, move.id).momentum) < 1e-9, "no passive gain without upgrades");
  }
  assert.equal(outreach(start, "story", T0).storyPosts, 1);
  assert.equal(outreach(start, "door", T0).doorKnocks, 1);
});

test("the story camera kit turns a door knock into a story too", () => {
  const start = initialState(T0);
  const before = outreachResult(start, "door");
  const withCamera = outreachResult({ ...start, upgrades: { receipts: 1 } }, "door");
  assert.equal(before.crossPostVisits, 0);
  assert.ok(withCamera.crossPostVisits > 0);
  assert.ok(withCamera.reach > before.reach);
});

test("buying an upgrade spends momentum and time, and refuses what it cannot afford", () => {
  const action = FIELD_ACTIONS[0];
  const start = initialState(T0);
  assert.equal(purchasableLevels(start, action, "one"), 0);
  assert.equal(buyUpgrade(start, action.id, "one", T0), start);
  const rich = funded(start, action.baseCost);
  const bought = buyUpgrade(rich, action.id, "one", T0);
  assert.equal(bought.upgrades[action.id], 1);
  assert.equal(bought.momentum, rich.momentum - action.baseCost);
  assert.equal(bought.campaignHours, upgradeTimeCost(0, 1));
  assert.ok(rateForState(bought) > 0);
  const locked = FIELD_ACTIONS[FIELD_ACTIONS.length - 1];
  assert.equal(purchasableLevels(funded(start, locked.baseCost * 10), locked, "one"), locked.unlock > locked.baseCost * 10 ? 0 : 1);
  assert.equal(buyUpgrade(rich, "no-such-upgrade", "one", T0), rich);
  const max = buyUpgrade(funded(start, 10_000), action.id, "max", T0);
  assert.ok(max.upgrades[action.id] > 1);
});

test("time spent building still trains organizers", () => {
  const trained = { ...initialState(T0), upgrades: { "one-pager": 5 }, momentum: 1_000, totalMomentum: 1_000 };
  const next = buyUpgrade(trained, "one-pager", "one", T0);
  assert.ok(next.organizers > trained.organizers);
});

test("mandates are ratified once, cost three days, and multiply training", () => {
  const mandate = MANDATES[0];
  const ready = funded(initialState(T0), mandate.cost);
  assert.equal(canRatify(ready, mandate.id), true);
  const done = ratify(ready, mandate.id, T0);
  assert.deepEqual(done.mandates, [mandate.id]);
  assert.equal(done.campaignHours, MANDATE_HOURS);
  assert.equal(canRatify(funded(done, mandate.cost * 2), mandate.id), false);
  const base = { ...initialState(T0), upgrades: { "one-pager": 3 } };
  assert.ok(Math.abs(rateForState({ ...base, mandates: [mandate.id] }) / rateForState(base) - mandate.boost) < 1e-9);
});

test("the campaign is lost when time runs out, won at 270, and frozen afterwards", () => {
  const late = { ...initialState(T0), campaignHours: ELECTION_HOURS };
  assert.equal(outcomeFor(late), "lost");
  assert.equal(outreach(late, "dm", T0), late);
  const lastHour = { ...initialState(T0), campaignHours: ELECTION_HOURS - 1 };
  assert.equal(outreach(lastHour, "door", T0), lastHour, "a 3-hour move does not fit in the last hour");
  assert.equal(outreach(lastHour, "dm", T0).campaignHours, ELECTION_HOURS);
  const won = { ...initialState(T0), organizers: ORGANIZERS_TO_WIN, reach: 1 };
  assert.equal(outcomeFor(won), "won");
  assert.equal(outreach(won, "story", T0), won, "no moves after Election Night");
  assert.equal(resultFor(won).outcome, "won");
});

test("the clock shows days and hours", () => {
  assert.equal(campaignDayFor(0), 1);
  assert.equal(campaignDayFor(23), 1);
  assert.equal(campaignDayFor(24), 2);
  assert.equal(campaignDayFor(ELECTION_HOURS), CAMPAIGN_DAYS);
  assert.equal(formatCampaignClock(0), "0H");
  assert.equal(formatCampaignClock(5), "5H");
  assert.equal(formatCampaignClock(49), "2D 1H");
});

test("saves from the original build still load, and damaged saves are repaired", () => {
  const original = { momentum: 50, totalMomentum: 80, conversations: 7, upgrades: { "one-pager": 2, ghost: 9 }, mandates: ["feed", "nope"], campaignHours: 40, lastSavedAt: T0 };
  const loaded = sanitizeSave(original, T0 + 1000)!;
  assert.equal(loaded.reach, 7, "reach falls back to conversations, as the original migration did");
  assert.ok(Math.abs(loaded.believers - 7 * 0.45) < 1e-9);
  assert.deepEqual(loaded.upgrades, { "one-pager": 2 });
  assert.deepEqual(loaded.mandates, ["feed"]);
  assert.ok(loaded.moves >= 7);
  assert.equal(sanitizeSave(null, T0), null);
  assert.equal(sanitizeSave([1], T0), null);
  const damaged = sanitizeSave({ momentum: -4, organizers: Number.NaN, campaignHours: 1e12, lastSavedAt: T0 * 9 }, T0)!;
  assert.equal(damaged.momentum, 0);
  assert.equal(damaged.organizers, 0);
  assert.equal(damaged.campaignHours, ELECTION_HOURS);
  assert.ok(damaged.lastSavedAt <= T0);
  assert.equal(STORAGE_KEY, "pres2032-citizen-save-v1", "the original save key is kept");
});

test("save codes round-trip and reject anything else", () => {
  const state = outreach(outreach(initialState(T0), "door", T0), "story", T0);
  const code = encodeSave(state);
  assert.deepEqual(decodeSave(code, T0 + 5), state);
  assert.equal(decodeSave("P28.!!!", T0), null);
  assert.equal(decodeSave("nonsense", T0), null);
});

test("challenge links carry a campaign day within the race", () => {
  assert.equal(parseChallengeDay("?day=198"), 198);
  assert.equal(parseChallengeDay("?a=1&day=7"), 7);
  assert.equal(parseChallengeDay("?day=0"), null);
  assert.equal(parseChallengeDay(`?day=${CAMPAIGN_DAYS + 1}`), null);
  assert.equal(parseChallengeDay("?day=12x"), null);
});

test("timeline thresholds rise and the data is well formed", () => {
  for (let index = 1; index < TIMELINE.length; index += 1) assert.ok(TIMELINE[index].threshold > TIMELINE[index - 1].threshold);
  assert.equal(new Set(FIELD_ACTIONS.map((action) => action.id)).size, FIELD_ACTIONS.length);
  assert.equal(new Set(MANDATES.map((mandate) => mandate.id)).size, MANDATES.length);
  for (const mandate of MANDATES) assert.ok(mandate.boost > 1);
  const names = FIELD_ACTIONS.map((action) => `${action.name} ${action.detail}`).join(" ");
  assert.doesNotMatch(names, /meta/i, "no trademarked product names in the upgrades");
});

test("a planned campaign and a casual one both win; a campaign that never builds loses", () => {
  const planner = simulateCampaign("planner");
  const casual = simulateCampaign("casual");
  const talker = simulateCampaign("talker");
  assert.equal(planner.outcome, "won");
  assert.equal(casual.outcome, "won");
  assert.equal(talker.outcome, "lost");
  assert.ok(planner.moves <= casual.moves, "planning takes fewer moves");
  // The balance target: a casual win takes long enough to be a game (20-40 minutes at a few seconds a move).
  assert.ok(casual.moves >= 300 && casual.moves <= 1200, `a casual win takes ${casual.moves} moves`);
  assert.ok(casual.day < CAMPAIGN_DAYS, "a casual player wins before the clock runs out");
});
