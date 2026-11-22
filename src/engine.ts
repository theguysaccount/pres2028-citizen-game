// PRES2028: Citizen. The whole game as data and pure functions: no DOM, no React, no clock of its own.
// Campaign time moves only when the player acts (each move costs campaign hours), so a run pauses while
// the player is away. The UI (CitizenGame.tsx), the unit tests, the scripted player and the guide all use
// this one module.
import { ELECTORAL_VOTES_TO_WIN, STATES, TOTAL_ELECTORAL_VOTES } from "./states.ts";
import type { StateInfo } from "./states.ts";

export { ELECTORAL_VOTES_TO_WIN, STATES, TOTAL_ELECTORAL_VOTES };

export type UpgradeLevels = Record<string, number>;
export type OutreachId = "door" | "dm" | "story";

export type SaveState = {
  momentum: number;
  totalMomentum: number;
  conversations: number;
  reach: number;
  believers: number;
  organizers: number;
  doorKnocks: number;
  dmsSent: number;
  storyPosts: number;
  upgrades: UpgradeLevels;
  mandates: string[];
  campaignHours: number;
  moves: number;
  lastSavedAt: number;
};

export type FieldAction = {
  id: string;
  code: string;
  name: string;
  detail: string;
  effect: string;
  baseCost: number;
  rate: number;
  unlock: number;
};

export type Mandate = {
  id: string;
  number: string;
  short: string;
  name: string;
  promise: string;
  cost: number;
  boost: number;
};

export type OutreachResult = {
  reach: number;
  believers: number;
  organizers: number;
  momentum: number;
  beliefRate: number;
  preview: string;
  crossPostVisits: number;
  hours: number;
};

export const OUTREACH_MOVES = [
  { id: "door", icon: "▥", label: "KNOCK A DOOR", sublabel: "FACE TO FACE", hours: 3 },
  { id: "dm", icon: "✉", label: "DM A FRIEND", sublabel: "REFINE THE MESSAGE", hours: 1 },
  { id: "story", icon: "▤", label: "POST A STORY", sublabel: "SEND TO THE SITE", hours: 2 },
] as const;

export const STORAGE_KEY = "pres2032-citizen-save-v1"; // kept from the original build, so existing saves still load
export const INTRO_KEY = "pres2028-intro-seen-v3";
export const UPGRADE_COST_GROWTH = 1.58;
export const UPGRADE_RATE_GROWTH = 1.42;
export const MOMENTUM_PER_ORGANIZER = 12;
export const CAMPAIGN_DAYS = 730;
export const ELECTION_HOURS = CAMPAIGN_DAYS * 24;
export const MANDATE_HOURS = 72;
// Balance pass (2026-11). Each campaign level multiplies output by CAMPAIGN_SCALE_BASE (the original used 2,
// which ended most runs in under 200 moves). Holding E electoral votes takes ORGANIZER_CURVE_SCALE * E^POWER
// organizers in all, so the first small states light up early and each new state is harder than the last.
export const CAMPAIGN_SCALE_BASE = 1.2;
export const ORGANIZER_CURVE_SCALE = 0.9;
export const ORGANIZER_CURVE_POWER = 1.75;

export const FIELD_ACTIONS: FieldAction[] = [
  {
    id: "one-pager",
    code: "F-01",
    name: "Story landing page",
    detail: "Every story opens a clear website that explains the campaign.",
    effect: "STORY +4%",
    baseCost: 12,
    rate: 0.005,
    unlock: 0,
  },
  {
    id: "porch",
    code: "F-02",
    name: "DM message lab",
    detail: "Test and refine the one-to-one message friends actually answer.",
    effect: "DM +8%",
    baseCost: 35,
    rate: 0.012,
    unlock: 25,
  },
  {
    // The original "Meta glasses kit": renamed (no trademark) and reframed around consent.
    id: "receipts",
    code: "F-03",
    name: "Story camera kit",
    detail: "With a neighbor's OK, a door conversation becomes a short story that sends people to the site.",
    effect: "DOOR → STORY",
    baseCost: 90,
    rate: 0.025,
    unlock: 60,
  },
  {
    id: "scorecards",
    code: "F-04",
    name: "Volunteer onboarding",
    detail: "Give every new believer one obvious first job in the campaign.",
    effect: "ORG +3%",
    baseCost: 260,
    rate: 0.07,
    unlock: 180,
  },
  {
    id: "captains",
    code: "F-05",
    name: "District captains",
    detail: "Local organizers train the next wave without waiting for headquarters.",
    effect: "LOCAL TEAMS",
    baseCost: 950,
    rate: 0.25,
    unlock: 700,
  },
  {
    id: "caucus",
    code: "F-06",
    name: "Creator network",
    detail: "Turn the daily conversation series into a national public narrative.",
    effect: "DAILY REACH",
    baseCost: 3400,
    rate: 0.9,
    unlock: 2800,
  },
  {
    id: "coalition",
    code: "F-07",
    name: "Unified States HQ",
    detail: "Coordinates trained organizers across all 50 states around the shared list.",
    effect: "50-STATE OPS",
    baseCost: 12500,
    rate: 3.2,
    unlock: 10500,
  },
];

// Fictional in-game platform planks. They are game mechanics, not pledges by anyone.
export const MANDATES: Mandate[] = [
  { id: "feed", number: "M-01", short: "FEEDS", name: "Feed Sovereignty", promise: "Your attention belongs to you.", cost: 180, boost: 1.08 },
  { id: "kitchen", number: "M-02", short: "FOOD", name: "Glass Kitchen", promise: "Open testing. Delicious food.", cost: 520, boost: 1.1 },
  { id: "inflation", number: "M-03", short: "MONEY", name: "Inflation Receipts", promise: "Name the silent tax in dollars.", cost: 1500, boost: 1.12 },
  { id: "corps", number: "M-04", short: "CORPS", name: "Abundance Corps", promise: "Public machines doing public work.", cost: 4100, boost: 1.16 },
  { id: "homes", number: "M-05", short: "HOMES", name: "Homes for All", promise: "Dignified shelter for everyone.", cost: 11000, boost: 1.2 },
  { id: "cures", number: "M-06", short: "CURES", name: "Open Cures", promise: "Public discovery, public benefit.", cost: 30000, boost: 1.24 },
  { id: "tutors", number: "M-07", short: "TUTORS", name: "A Tutor for Every Child", promise: "An aristocrat's education for all.", cost: 72000, boost: 1.28 },
  { id: "suggestion", number: "M-08", short: "VOICE", name: "National Suggestion Box", promise: "Dream in public. Answer the people.", cost: 165000, boost: 1.35 },
];

export const TIMELINE = [
  { year: "2026", threshold: 0, title: "LAUNCH THE LIST", copy: "Start the citizen campaign." },
  { year: "2026", threshold: 120, title: "PROVE THE MESSAGE", copy: "Find what makes people believe." },
  { year: "2027", threshold: 900, title: "BUILD STATE TEAMS", copy: "Train local organizers." },
  { year: "JAN '28", threshold: 6500, title: "MAKE THE BALLOT", copy: "Qualify across the country." },
  { year: "JUN '28", threshold: 25000, title: "NATIONAL CAMPAIGN", copy: "Turn local proof into national support." },
  { year: "SEP '28", threshold: 90000, title: "ROAD TO 270", copy: "Lock in the electoral path." },
  { year: "NOV '28", threshold: 220000, title: "GET OUT THE VOTE", copy: "Convert belief into turnout." },
  { year: "ELECTION", threshold: 500000, title: "WIN 2028", copy: "Reach 270 before time runs out." },
];

// The order the campaign's organizers reach states: smallest delegations first (fewest organizers needed),
// ties broken alphabetically. Each state needs ORGANIZERS_PER_ELECTORAL_VOTE organizers per electoral vote.
export const STATE_ORDER: StateInfo[] = [...STATES].sort((a, b) => a.ev - b.ev || a.name.localeCompare(b.name));

const ACTION_BY_ID = new Map(FIELD_ACTIONS.map((action) => [action.id, action]));
const MANDATE_BY_ID = new Map(MANDATES.map((mandate) => [mandate.id, mandate]));

export function actionById(id: string) {
  return ACTION_BY_ID.get(id);
}

export function mandateById(id: string) {
  return MANDATE_BY_ID.get(id);
}

export function initialState(now: number): SaveState {
  return {
    momentum: 0,
    totalMomentum: 0,
    conversations: 0,
    reach: 0,
    believers: 0,
    organizers: 0,
    doorKnocks: 0,
    dmsSent: 0,
    storyPosts: 0,
    upgrades: {},
    mandates: [],
    campaignHours: 0,
    moves: 0,
    lastSavedAt: now,
  };
}

// ---- Formatting ----

export function formatNumber(value: number, compact = false) {
  if (!Number.isFinite(value)) return "0";
  if (compact && value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (compact && value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return Math.floor(value).toLocaleString("en-US");
}

export function formatRate(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  if (value >= 100) return value.toFixed(0);
  if (value >= 1) return value.toFixed(1);
  if (value < 0.1) return value.toFixed(3);
  return value.toFixed(2);
}

export function formatCampaignClock(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "0H";
  const rounded = Math.ceil(hours);
  const days = Math.floor(rounded / 24);
  const remainingHours = rounded % 24;
  return days > 0 ? `${days}D ${remainingHours}H` : `${remainingHours}H`;
}

export function campaignDayFor(hours: number) {
  return Math.min(CAMPAIGN_DAYS, Math.floor(hours / 24) + 1);
}

// ---- Rules ----

export function upgradeCost(action: FieldAction, level: number) {
  return Math.floor(action.baseCost * Math.pow(UPGRADE_COST_GROWTH, level));
}

export function actionRateAtLevel(action: FieldAction, level: number) {
  if (level <= 0) return 0;
  return action.rate * level * Math.pow(UPGRADE_RATE_GROWTH, level - 1);
}

export function actionRateGain(action: FieldAction, level: number, quantity = 1) {
  return actionRateAtLevel(action, level + quantity) - actionRateAtLevel(action, level);
}

export function upgradeBatchCost(action: FieldAction, level: number, quantity: number) {
  let total = 0;
  for (let offset = 0; offset < quantity; offset += 1) total += upgradeCost(action, level + offset);
  return total;
}

export function upgradeTimeCost(level: number, quantity: number) {
  return Math.ceil((36 + level * 4) * quantity);
}

export function maxAffordablePurchases(action: FieldAction, level: number, budget: number) {
  let quantity = 0;
  let cost = 0;
  while (quantity < 500) {
    const nextCost = upgradeCost(action, level + quantity);
    if (cost + nextCost > budget) break;
    cost += nextCost;
    quantity += 1;
  }
  return { quantity, cost };
}

export function mandateMultiplier(ids: string[]) {
  return MANDATES.reduce((total, mandate) => (ids.includes(mandate.id) ? total * mandate.boost : total), 1);
}

export function getStageIndex(total: number) {
  let index = 0;
  TIMELINE.forEach((stage, stageIndex) => {
    if (total >= stage.threshold) index = stageIndex;
  });
  return index;
}

export function campaignScaleFor(total: number) {
  return Math.pow(CAMPAIGN_SCALE_BASE, getStageIndex(total));
}

// Organizers trained per campaign day by the field upgrades.
export function rateForState(state: SaveState) {
  const raw = FIELD_ACTIONS.reduce((total, action) => total + actionRateAtLevel(action, state.upgrades[action.id] || 0), 0);
  return raw * mandateMultiplier(state.mandates) * campaignScaleFor(state.totalMomentum);
}

export function passiveProgressFor(state: SaveState, hours: number) {
  const organizerGain = rateForState(state) * (hours / 24);
  return {
    reach: organizerGain * 4,
    believers: organizerGain * 2.5,
    organizers: organizerGain,
    momentum: organizerGain * MOMENTUM_PER_ORGANIZER,
  };
}

export function outreachResult(state: SaveState, id: OutreachId): OutreachResult {
  const landingPageLevel = state.upgrades["one-pager"] || 0;
  const dmLabLevel = state.upgrades.porch || 0;
  const cameraLevel = state.upgrades.receipts || 0;
  const onboardingLevel = state.upgrades.scorecards || 0;
  const organizerBonus = onboardingLevel * 0.03 + state.mandates.length * 0.005;

  const storyBeliefRate = Math.min(0.68, 0.18 + landingPageLevel * 0.04);
  const dmBeliefRate = Math.min(0.84, 0.45 + dmLabLevel * 0.08);
  const doorBeliefRate = Math.min(0.92, 0.68 + cameraLevel * 0.03);

  let reach = 1;
  let believers = 0;
  let organizers = 0;
  let beliefRate = doorBeliefRate;
  let preview = "1 CONVERSATION";
  let crossPostVisits = 0;
  const hours = OUTREACH_MOVES.find((move) => move.id === id)!.hours;

  if (id === "story") {
    reach = 8 + landingPageLevel * 2;
    beliefRate = storyBeliefRate;
    believers = reach * beliefRate;
    organizers = believers * Math.min(0.36, 0.04 + organizerBonus);
    preview = `${reach} SITE VISITS`;
  } else if (id === "dm") {
    beliefRate = dmBeliefRate;
    believers = beliefRate;
    organizers = believers * Math.min(0.4, 0.1 + organizerBonus);
    preview = `${Math.round(beliefRate * 100)}% BELIEVE`;
  } else {
    believers = doorBeliefRate;
    organizers = believers * Math.min(0.48, 0.18 + organizerBonus);
    if (cameraLevel > 0) {
      crossPostVisits = 6 + cameraLevel * 2;
      const storyBelievers = crossPostVisits * storyBeliefRate;
      reach += crossPostVisits;
      believers += storyBelievers;
      organizers += storyBelievers * Math.min(0.36, 0.04 + organizerBonus);
      preview = "TALK + STORY";
    }
  }

  const momentum = (reach * 0.25 + believers * 3 + organizers * 20) * campaignScaleFor(state.totalMomentum);
  return { reach, believers, organizers, momentum, beliefRate, preview, crossPostVisits, hours };
}

// ---- The map ----

// Organizers needed in all to hold `electoralVotes` electoral votes.
export function organizersToHold(electoralVotes: number) {
  return Math.round(ORGANIZER_CURVE_SCALE * Math.pow(Math.max(0, electoralVotes), ORGANIZER_CURVE_POWER));
}

export type MapProgress = {
  organized: StateInfo[];
  electoralVotes: number;
  next: StateInfo | null;
  nextProgress: number; // 0..1 toward the next state
  nextNeeds: number; // organizers in all for the next state
};

export function mapProgressFor(organizers: number): MapProgress {
  const have = Math.max(0, organizers);
  const organized: StateInfo[] = [];
  let electoralVotes = 0;
  for (const state of STATE_ORDER) {
    const before = organizersToHold(electoralVotes);
    const after = organizersToHold(electoralVotes + state.ev);
    if (have + 1e-9 < after) {
      return { organized, electoralVotes, next: state, nextProgress: Math.min(1, Math.max(0, (have - before) / (after - before))), nextNeeds: after };
    }
    organized.push(state);
    electoralVotes += state.ev;
  }
  return { organized, electoralVotes, next: null, nextProgress: 1, nextNeeds: organizersToHold(electoralVotes) };
}

// Organizers needed to reach 270, by the same rule the map uses.
export const ORGANIZERS_TO_WIN = (() => {
  let votes = 0;
  for (const state of STATE_ORDER) {
    votes += state.ev;
    if (votes >= ELECTORAL_VOTES_TO_WIN) return organizersToHold(votes);
  }
  return organizersToHold(votes);
})();

export type Outcome = "playing" | "won" | "lost";

export function outcomeFor(state: SaveState): Outcome {
  const { electoralVotes } = mapProgressFor(state.organizers);
  if (electoralVotes >= ELECTORAL_VOTES_TO_WIN) return "won";
  if (state.campaignHours >= ELECTION_HOURS || !anyMoveFits(state)) return "lost";
  return "playing";
}

function anyMoveFits(state: SaveState) {
  const left = ELECTION_HOURS - state.campaignHours;
  return OUTREACH_MOVES.some((move) => move.hours <= left);
}

export function hoursRemaining(state: SaveState) {
  return Math.max(0, ELECTION_HOURS - state.campaignHours);
}

// ---- Moves. Each returns a new state, or the same object when the move is not allowed. ----

function addPassive(state: SaveState, hours: number) {
  const passive = passiveProgressFor(state, hours);
  return {
    momentum: state.momentum + passive.momentum,
    totalMomentum: state.totalMomentum + passive.momentum,
    reach: state.reach + passive.reach,
    believers: state.believers + passive.believers,
    organizers: state.organizers + passive.organizers,
    campaignHours: state.campaignHours + hours,
    passive,
  };
}

export function canOutreach(state: SaveState, id: OutreachId) {
  const move = OUTREACH_MOVES.find((candidate) => candidate.id === id);
  return Boolean(move) && outcomeFor(state) === "playing" && move!.hours <= hoursRemaining(state);
}

export function outreach(state: SaveState, id: OutreachId, now: number): SaveState {
  if (!canOutreach(state, id)) return state;
  const result = outreachResult(state, id);
  const after = addPassive(state, result.hours);
  return {
    ...state,
    momentum: after.momentum + result.momentum,
    totalMomentum: after.totalMomentum + result.momentum,
    reach: after.reach + result.reach,
    believers: after.believers + result.believers,
    organizers: after.organizers + result.organizers,
    campaignHours: after.campaignHours,
    conversations: state.conversations + 1,
    doorKnocks: state.doorKnocks + (id === "door" ? 1 : 0),
    dmsSent: state.dmsSent + (id === "dm" ? 1 : 0),
    storyPosts: state.storyPosts + (id === "story" || result.crossPostVisits > 0 ? 1 : 0),
    moves: state.moves + 1,
    lastSavedAt: now,
  };
}

// How many levels of an upgrade can be bought now: limited by momentum and by campaign time.
export function purchasableLevels(state: SaveState, action: FieldAction, mode: "one" | "max") {
  if (outcomeFor(state) !== "playing" || state.totalMomentum < action.unlock) return 0;
  const level = state.upgrades[action.id] || 0;
  const affordable = maxAffordablePurchases(action, level, state.momentum).quantity;
  let quantity = mode === "max" ? affordable : Math.min(1, affordable);
  while (quantity > 0 && upgradeTimeCost(level, quantity) > hoursRemaining(state)) quantity -= 1;
  return quantity;
}

export function buyUpgrade(state: SaveState, actionId: string, mode: "one" | "max", now: number): SaveState {
  const action = ACTION_BY_ID.get(actionId);
  if (!action) return state;
  const quantity = purchasableLevels(state, action, mode);
  if (quantity < 1) return state;
  const level = state.upgrades[action.id] || 0;
  const cost = upgradeBatchCost(action, level, quantity);
  const after = addPassive(state, upgradeTimeCost(level, quantity));
  return {
    ...state,
    momentum: after.momentum - cost,
    totalMomentum: after.totalMomentum,
    reach: after.reach,
    believers: after.believers,
    organizers: after.organizers,
    campaignHours: after.campaignHours,
    upgrades: { ...state.upgrades, [action.id]: level + quantity },
    moves: state.moves + 1,
    lastSavedAt: now,
  };
}

export function canRatify(state: SaveState, mandateId: string) {
  const mandate = MANDATE_BY_ID.get(mandateId);
  if (!mandate || outcomeFor(state) !== "playing") return false;
  return !state.mandates.includes(mandate.id) && state.momentum >= mandate.cost && hoursRemaining(state) >= MANDATE_HOURS;
}

export function ratify(state: SaveState, mandateId: string, now: number): SaveState {
  if (!canRatify(state, mandateId)) return state;
  const mandate = MANDATE_BY_ID.get(mandateId)!;
  const after = addPassive(state, MANDATE_HOURS);
  return {
    ...state,
    momentum: after.momentum - mandate.cost,
    totalMomentum: after.totalMomentum,
    reach: after.reach,
    believers: after.believers,
    organizers: after.organizers,
    campaignHours: after.campaignHours,
    mandates: [...state.mandates, mandate.id],
    moves: state.moves + 1,
    lastSavedAt: now,
  };
}

// ---- Saves ----

function finite(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

// Turn anything read from storage (or a pasted save code) into a valid state. Old saves from the original
// build (no `moves`, older fields) are migrated the way the original migrated them.
export function sanitizeSave(raw: unknown, now: number): SaveState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const upgrades: UpgradeLevels = {};
  if (input.upgrades && typeof input.upgrades === "object" && !Array.isArray(input.upgrades)) {
    for (const action of FIELD_ACTIONS) {
      const level = Math.floor(finite((input.upgrades as Record<string, unknown>)[action.id], 0, 0, 400));
      if (level > 0) upgrades[action.id] = level;
    }
  }
  const mandates = Array.isArray(input.mandates)
    ? MANDATES.filter((mandate) => (input.mandates as unknown[]).includes(mandate.id)).map((mandate) => mandate.id)
    : [];
  const conversations = Math.floor(finite(input.conversations));
  const momentum = finite(input.momentum);
  return {
    momentum,
    totalMomentum: Math.max(momentum, finite(input.totalMomentum)),
    conversations,
    reach: finite(input.reach, conversations),
    believers: finite(input.believers, conversations * 0.45),
    organizers: finite(input.organizers),
    doorKnocks: Math.floor(finite(input.doorKnocks)),
    dmsSent: Math.floor(finite(input.dmsSent)),
    storyPosts: Math.floor(finite(input.storyPosts)),
    upgrades,
    mandates,
    campaignHours: finite(input.campaignHours, 0, 0, ELECTION_HOURS),
    moves: Math.floor(finite(input.moves, conversations + Object.values(upgrades).length + mandates.length)),
    lastSavedAt: finite(input.lastSavedAt, now, 0, now),
  };
}

const SAVE_CODE_PREFIX = "P28.";

export function encodeSave(state: SaveState) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return SAVE_CODE_PREFIX + btoa(binary);
}

export function decodeSave(code: string, now: number): SaveState | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SAVE_CODE_PREFIX) || trimmed.length > 20_000) return null;
  try {
    const binary = atob(trimmed.slice(SAVE_CODE_PREFIX.length));
    const text = new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
    return sanitizeSave(JSON.parse(text), now);
  } catch {
    return null;
  }
}

// ---- Result cards and challenge links: ?day=<campaign day the friend won on> ----

export type ResultSummary = {
  outcome: Outcome;
  day: number;
  daysLeft: number;
  electoralVotes: number;
  statesOrganized: number;
  mandates: number;
  moves: number;
  organizers: number;
};

export function resultFor(state: SaveState): ResultSummary {
  const map = mapProgressFor(state.organizers);
  return {
    outcome: outcomeFor(state),
    day: campaignDayFor(state.campaignHours),
    daysLeft: Math.floor(hoursRemaining(state) / 24),
    electoralVotes: map.electoralVotes,
    statesOrganized: map.organized.length,
    mandates: state.mandates.length,
    moves: state.moves,
    organizers: Math.floor(state.organizers),
  };
}

export function parseChallengeDay(search: string): number | null {
  const match = /[?&]day=(\d{1,3})(?:&|$)/.exec(search);
  if (!match) return null;
  const day = Number(match[1]);
  return day >= 1 && day <= CAMPAIGN_DAYS ? day : null;
}
