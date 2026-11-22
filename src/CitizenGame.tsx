import { useEffect, useMemo, useRef, useState } from "react";
import {
  CAMPAIGN_DAYS,
  ELECTORAL_VOTES_TO_WIN,
  FIELD_ACTIONS,
  INTRO_KEY,
  MANDATES,
  MANDATE_HOURS,
  MOMENTUM_PER_ORGANIZER,
  OUTREACH_MOVES,
  STORAGE_KEY,
  TIMELINE,
  actionRateGain,
  buyUpgrade,
  campaignDayFor,
  campaignScaleFor,
  canRatify,
  decodeSave,
  encodeSave,
  formatCampaignClock,
  formatNumber,
  formatRate,
  getStageIndex,
  hoursRemaining,
  initialState,
  mandateMultiplier,
  mapProgressFor,
  outcomeFor,
  outreach,
  outreachResult,
  parseChallengeDay,
  passiveProgressFor,
  purchasableLevels,
  ratify,
  rateForState,
  resultFor,
  sanitizeSave,
  upgradeCost,
  upgradeTimeCost,
} from "./engine.ts";
import type { FieldAction, Mandate, OutreachId, SaveState } from "./engine.ts";
import type { SiteConfig } from "./config.ts";
import { track } from "./config.ts";
import UsaMap from "./UsaMap.tsx";
import ResultPanel from "./ResultPanel.tsx";
import { copyText } from "./share.ts";

type ViewName = "play" | "upgrades" | "map";
type SystemTab = "field" | "mandates" | "roadmap";
type ValuePopup = { id: number; target: string; text: string };

type Mission = {
  label: string;
  title: string;
  instruction: string;
  progress: number;
  progressLabel: string;
  targetView?: ViewName;
  targetTab?: SystemTab;
  targetAction?: OutreachId;
};

const CHALLENGE_KEY = "pres2028-challenge-v1";

// localStorage can be missing or blocked (private windows, embedded frames). The game still plays.
const storage = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
};

function getMission(state: SaveState, electoralVotes: number, campaignHoursRemaining: number): Mission {
  if (state.reach < 10) {
    return {
      label: "MISSION 01 // PROVE THE FUNNEL",
      title: "INFORM 10 PEOPLE",
      instruction: "A story sends people to the website. A DM or door knock starts with trust.",
      progress: (state.reach / 10) * 100,
      progressLabel: `${formatNumber(state.reach)} / 10 PEOPLE REACHED`,
    };
  }
  if ((state.upgrades["one-pager"] || 0) === 0) {
    return {
      label: "MISSION 02 // GIVE THE STORY A DESTINATION",
      title: "BUILD THE WEBSITE",
      instruction: "Buy the Story Landing Page so more visitors understand and believe.",
      progress: Math.min(100, (state.momentum / 12) * 100),
      progressLabel: `${formatNumber(state.momentum)} / 12 MOMENTUM`,
      targetView: "upgrades",
      targetTab: "field",
    };
  }
  if ((state.upgrades.receipts || 0) === 0) {
    return {
      label: "MISSION 03 // CONNECT REAL LIFE TO THE FEED",
      title: "UNLOCK DOOR-TO-STORY",
      instruction: "Buy the Story Camera Kit. With a neighbor's OK, each door conversation becomes a short story.",
      progress: Math.min(100, (state.momentum / 90) * 100),
      progressLabel: `${formatNumber(state.momentum)} / 90 MOMENTUM`,
      targetView: "upgrades",
      targetTab: "field",
    };
  }
  if (state.doorKnocks < 3) {
    return {
      label: "MISSION 04 // DAY-BY-DAY DOCUMENTARY",
      title: "RECORD 3 DOOR TALKS",
      instruction: "Each conversation, shared with permission, becomes a story on the road to 270.",
      progress: (state.doorKnocks / 3) * 100,
      progressLabel: `${state.doorKnocks} / 3 CONVERSATIONS SHARED`,
      targetAction: "door",
    };
  }
  if (state.mandates.length === 0) {
    return {
      label: "MISSION 05 // CHOOSE THE LIST",
      title: "RATIFY M-01",
      instruction: "Save 180 momentum, then ratify Feed Sovereignty for a permanent boost.",
      progress: Math.min(100, (state.momentum / 180) * 100),
      progressLabel: `${formatNumber(state.momentum)} / 180 MOMENTUM`,
      targetView: "upgrades",
      targetTab: "mandates",
    };
  }
  return {
    label: "NATIONAL MISSION // ROAD TO 270",
    title: electoralVotes >= ELECTORAL_VOTES_TO_WIN ? "270 SECURED" : `${ELECTORAL_VOTES_TO_WIN - electoralVotes} EV TO WIN`,
    instruction: "Train enough state teams to win the 2028 Electoral College before campaign time expires.",
    progress: Math.min(100, (electoralVotes / ELECTORAL_VOTES_TO_WIN) * 100),
    progressLabel: `${electoralVotes} / ${ELECTORAL_VOTES_TO_WIN} EV · ${formatCampaignClock(campaignHoursRemaining)} LEFT`,
    targetView: "map",
  };
}

export default function CitizenGame({ config }: { config: SiteConfig }) {
  const [state, setState] = useState<SaveState>(() => initialState(0));
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("The movement is waiting for your first move.");
  const [valuePopup, setValuePopup] = useState<ValuePopup | null>(null);
  const [activeView, setActiveView] = useState<ViewName>("play");
  const [systemTab, setSystemTab] = useState<SystemTab>("field");
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSaveTools, setShowSaveTools] = useState(false);
  const [saveCode, setSaveCode] = useState("");
  const [resultDismissed, setResultDismissed] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [challengeDay, setChallengeDay] = useState<number | null>(null);
  const previousStage = useRef(0);
  const popupSequence = useRef(0);
  const latest = useRef<SaveState | null>(null);
  const previousOutcome = useRef("playing");

  useEffect(() => {
    const now = Date.now();
    let restored = initialState(now);
    let restoredNotice = "";
    const saved = storage.get(STORAGE_KEY);
    if (saved) {
      try {
        const clean = sanitizeSave(JSON.parse(saved), now);
        if (clean) {
          restored = { ...clean, lastSavedAt: now };
          if (clean.moves > 0) restoredNotice = "Campaign paused while you were away. No election time was lost.";
        }
      } catch {
        storage.remove(STORAGE_KEY);
      }
    }
    const linked = parseChallengeDay(window.location.search);
    const remembered = parseChallengeDay(`?day=${storage.get(CHALLENGE_KEY) || ""}`);
    if (linked) storage.set(CHALLENGE_KEY, String(linked));
    const day = linked ?? remembered;
    // One-time client hydration from the device-local save.
    setState(restored);
    setChallengeDay(day);
    if (day && restored.moves === 0) {
      restoredNotice = `CHALLENGE — a friend won 2028 on campaign day ${day}. Clinch 270 sooner.`;
    }
    if (restoredNotice) setNotice(restoredNotice);
    setShowHowToPlay(!storage.get(INTRO_KEY));
    previousStage.current = getStageIndex(restored.totalMomentum);
    previousOutcome.current = outcomeFor(restored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    latest.current = state;
    const saver = window.setTimeout(() => {
      storage.set(STORAGE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
    }, 200);
    return () => window.clearTimeout(saver);
  }, [state, ready]);

  // Write the save at once when the page is hidden or closed, so the last move is never lost.
  useEffect(() => {
    if (!ready) return;
    const flush = () => {
      if (latest.current) storage.set(STORAGE_KEY, JSON.stringify({ ...latest.current, lastSavedAt: Date.now() }));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready]);

  const organizerRatePerDay = useMemo(() => rateForState(state), [state]);
  const multiplier = useMemo(() => mandateMultiplier(state.mandates), [state.mandates]);
  const campaignScale = campaignScaleFor(state.totalMomentum);
  const momentumPerDay = organizerRatePerDay * MOMENTUM_PER_ORGANIZER;
  const outreachById = useMemo(
    () => ({ door: outreachResult(state, "door"), dm: outreachResult(state, "dm"), story: outreachResult(state, "story") }),
    [state],
  );
  const stageIndex = getStageIndex(state.totalMomentum);
  const currentStage = TIMELINE[stageIndex];
  const nextStage = TIMELINE[Math.min(stageIndex + 1, TIMELINE.length - 1)];
  const stageProgress =
    stageIndex === TIMELINE.length - 1
      ? 100
      : Math.min(100, ((state.totalMomentum - currentStage.threshold) / (nextStage.threshold - currentStage.threshold)) * 100);
  const map = useMemo(() => mapProgressFor(state.organizers), [state.organizers]);
  const electoralVotes = map.electoralVotes;
  const nationalProgress = Math.min(100, (electoralVotes / ELECTORAL_VOTES_TO_WIN) * 100);
  const campaignHoursRemaining = hoursRemaining(state);
  const outcome = outcomeFor(state);
  const campaignOver = outcome !== "playing";
  const mission = getMission(state, electoralVotes, campaignHoursRemaining);
  const networkLevel = stageIndex + 1;

  useEffect(() => {
    if (!ready) return;
    if (stageIndex > previousStage.current) {
      setNotice(`CAMPAIGN LEVEL ${stageIndex + 1} — ×${formatRate(campaignScaleFor(state.totalMomentum))} SCALE UNLOCKED.`);
      track(`level_${stageIndex + 1}`);
    }
    previousStage.current = stageIndex;
  }, [stageIndex, ready, state.totalMomentum]);

  useEffect(() => {
    if (!ready) return;
    if (outcome !== "playing" && previousOutcome.current === "playing") {
      storage.set(STORAGE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
      track(outcome === "won" ? "campaign_won" : "campaign_lost");
      setResultDismissed(false);
    }
    previousOutcome.current = outcome;
  }, [ready, outcome, state]);

  function showValuePopup(target: string, text: string) {
    popupSequence.current += 1;
    setValuePopup({ id: popupSequence.current, target, text });
  }

  function performOutreach(id: OutreachId) {
    const result = outreachById[id];
    if (campaignOver || result.hours > campaignHoursRemaining) return;
    const passive = passiveProgressFor(state, result.hours);
    const nextCampaignDay = campaignDayFor(state.campaignHours + result.hours);
    if (state.moves === 0) track("campaign_start");
    const now = Date.now();
    setState((current) => outreach(current, id, now));
    showValuePopup(
      `outreach-${id}`,
      `+${formatNumber(result.reach + passive.reach)} REACH · +${formatRate(result.believers + passive.believers)} BELIEVE · +${formatNumber(result.momentum + passive.momentum)} MOM · ${result.hours}H`,
    );
    if (id === "door") {
      setNotice(
        result.crossPostVisits > 0
          ? `CAMPAIGN DAY ${nextCampaignDay} — with the neighbor's OK, the conversation became a story; ${result.crossPostVisits} people visited the website.`
          : `CAMPAIGN DAY ${nextCampaignDay} — one real conversation logged. The Story Camera Kit can share future ones (with permission).`,
      );
    } else if (id === "dm") {
      const messageVersion = (state.upgrades.porch || 0) + 1;
      setNotice(`DM MESSAGE V${messageVersion} — one friend informed; ${Math.round(result.beliefRate * 100)}% currently become believers.`);
    } else {
      setNotice(`STORY → WEBSITE — ${result.reach} visits; ${Math.round(result.beliefRate * 100)}% understand enough to believe.`);
    }
    try {
      window.navigator.vibrate?.(18);
    } catch {
      // Vibration is optional.
    }
  }

  function buyAction(action: FieldAction, mode: "one" | "max" = "one") {
    const quantity = purchasableLevels(state, action, mode);
    if (quantity < 1) return;
    const level = state.upgrades[action.id] || 0;
    const hours = upgradeTimeCost(level, quantity);
    const rateGain = actionRateGain(action, level, quantity) * multiplier * campaignScale;
    const now = Date.now();
    setState((current) => buyUpgrade(current, action.id, mode, now));
    const firstCamera = action.id === "receipts" && level === 0;
    showValuePopup(`field-${action.id}`, firstCamera ? `DOOR → STORY · ${formatCampaignClock(hours)}` : `+${formatRate(rateGain)} ORG / DAY · ${formatCampaignClock(hours)}`);
    setNotice(
      firstCamera
        ? `STORY CAMERA KIT READY — with each neighbor's OK, a door conversation now becomes a story. Build time: ${formatCampaignClock(hours)}.`
        : `${action.name.toUpperCase()} +${quantity} LEVEL${quantity > 1 ? "S" : ""} — +${formatRate(rateGain)} organizers per day. Build time: ${formatCampaignClock(hours)}.`,
    );
  }

  function ratifyMandate(mandate: Mandate) {
    if (!canRatify(state, mandate.id)) return;
    const now = Date.now();
    setState((current) => ratify(current, mandate.id, now));
    showValuePopup(`mandate-${mandate.id}`, `×${mandate.boost.toFixed(2)} BOOST · 3 DAYS`);
    setNotice(`${mandate.number} RATIFIED — every operation gets stronger. Ratification used 3 campaign days.`);
  }

  function runMissionAction() {
    if (mission.targetAction) {
      performOutreach(mission.targetAction);
      return;
    }
    if (mission.targetView) setActiveView(mission.targetView);
    if (mission.targetTab) setSystemTab(mission.targetTab);
  }

  function closeIntro() {
    storage.set(INTRO_KEY, "seen");
    setShowHowToPlay(false);
  }

  function resetGame(confirmed = false) {
    if (!resetArmed && !confirmed) {
      setResetArmed(true);
      setNotice("PRESS RESET AGAIN TO ERASE THIS RUN.");
      return;
    }
    const fresh = initialState(Date.now());
    storage.set(STORAGE_KEY, JSON.stringify(fresh));
    setState(fresh);
    setNotice("NEW RUN — choose your first outreach move.");
    setActiveView("play");
    setSystemTab("field");
    setResultDismissed(false);
    setResetArmed(false);
    previousStage.current = 0;
    previousOutcome.current = "playing";
  }

  async function copySaveCode() {
    const code = encodeSave({ ...state, lastSavedAt: Date.now() });
    const copied = await copyText(code);
    if (!copied) setSaveCode(code);
    setNotice(copied ? "SAVE CODE COPIED — paste it into this game on any device to carry on." : "Copy the code in the box by hand.");
  }

  function loadSaveCode() {
    const loaded = decodeSave(saveCode, Date.now());
    if (!loaded) {
      setNotice("THAT SAVE CODE COULD NOT BE READ — copy the whole code and try again.");
      return;
    }
    storage.set(STORAGE_KEY, JSON.stringify(loaded));
    setState(loaded);
    previousStage.current = getStageIndex(loaded.totalMomentum);
    previousOutcome.current = outcomeFor(loaded);
    setSaveCode("");
    setShowSaveTools(false);
    setNotice("SAVE LOADED — the campaign carries on from where it was.");
  }

  const result = resultFor(state);

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="wordmark">PRES<span>2028</span><small>/ CITIZEN</small></div>
        <div className="header-goal">
          <span>LEVEL {networkLevel} · ×{formatRate(campaignScale)}</span>
          <div><i style={{ width: `${stageProgress}%` }} /></div>
          <b>{TIMELINE[stageIndex].year}</b>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setShowHowToPlay(true)}>HOW TO PLAY</button>
          <button type="button" onClick={() => setShowSaveTools(true)} data-testid="open-save">SAVE</button>
          <button className={resetArmed ? "danger" : ""} type="button" onClick={() => resetGame()}>{resetArmed ? "CONFIRM RESET" : "RESET"}</button>
        </div>
      </header>

      <section className="game-board">
        <aside className={`mission-panel game-panel ${activeView === "play" ? "mobile-active" : ""}`} data-testid="play-view">
          <div className="compact-stats">
            <div><span>MOMENTUM</span><strong data-testid="momentum">{formatNumber(state.momentum, true)}<small>+{formatRate(momentumPerDay)}/DAY</small></strong></div>
            <div><span>BELIEVERS</span><strong>{formatNumber(state.believers, true)}</strong></div>
            <div><span>ORGANIZERS</span><strong data-testid="organizers">{formatNumber(state.organizers, true)}<small>+{formatRate(organizerRatePerDay)}/DAY</small></strong></div>
          </div>

          <div className="loop-strip" aria-label="2028 campaign clock">
            <span className="current" data-testid="campaign-day">DAY {campaignDayFor(state.campaignHours)} / {CAMPAIGN_DAYS}</span><i>›</i><span>{formatCampaignClock(campaignHoursRemaining)} LEFT</span><i>›</i><span data-testid="ev-strip">{electoralVotes} / {ELECTORAL_VOTES_TO_WIN} EV</span>
          </div>

          <div className="mission-card">
            <span>{mission.label}</span>
            <h1 data-testid="mission-title">{mission.title}</h1>
            <p>{mission.instruction}</p>
            <div className="mission-meter"><i style={{ width: `${Math.max(0, Math.min(100, mission.progress))}%` }} /></div>
            <small>{mission.progressLabel}</small>
            {(mission.targetView || mission.targetAction) && (
              <button className="mission-jump" type="button" disabled={campaignOver && Boolean(mission.targetAction)} onClick={runMissionAction} data-testid="mission-jump">
                {mission.targetAction ? "KNOCK A DOOR NOW →" : mission.targetView === "upgrades" ? "OPEN UPGRADES →" : "OPEN USA MAP →"}
              </button>
            )}
          </div>

          <div className="outreach-grid" aria-label="Choose an outreach move" data-testid="primary-action">
            {OUTREACH_MOVES.map((move) => {
              const preview = outreachById[move.id];
              return (
                <button
                  className={`outreach-button ${move.id}`}
                  type="button"
                  onClick={() => performOutreach(move.id)}
                  disabled={campaignOver || move.hours > campaignHoursRemaining}
                  data-testid={`outreach-${move.id}`}
                  key={move.id}
                >
                  <mark>{move.hours}H</mark>
                  <span aria-hidden="true">{move.icon}</span>
                  <b>{move.label}</b>
                  <small>{move.sublabel}</small>
                  <em>{preview.preview}</em>
                  {valuePopup?.target === `outreach-${move.id}` && <output className="value-popup" key={valuePopup.id}>{valuePopup.text}</output>}
                </button>
              );
            })}
          </div>

          <div className="field-log" role="status" aria-live="polite"><span>LIVE</span><p data-testid="notice">{notice}</p></div>
        </aside>

        <section className={`map-panel game-panel ${activeView === "map" ? "mobile-active" : ""}`} data-testid="map-view">
          <div className="panel-title">
            <div><span>2028 ELECTORAL MAP</span><h2>THE ROAD TO 270</h2></div>
            <strong data-testid="ev-count">{electoralVotes}<small>/{ELECTORAL_VOTES_TO_WIN} EV</small></strong>
          </div>

          <div className="map-stage">
            <UsaMap progress={map} />
            <div className="map-year"><span>CAMPAIGN</span><b>DAY {campaignDayFor(state.campaignHours)}</b></div>
          </div>

          <div className="map-legend">
            <span><i className="organized" /> ORGANIZED</span>
            <span><i className="next" /> NEXT</span>
            <p data-testid="next-state">
              {map.next
                ? `Next: ${map.next.name} (${map.next.ev} EV), ${Math.round(map.nextProgress * 100)}% organized · ${formatNumber(map.nextNeeds)} organizers in all`
                : "Every state and DC organized."}
            </p>
          </div>

          <div className="national-milestone">
            <span>CURRENT ERA</span>
            <h3>{TIMELINE[stageIndex].title}</h3>
            <p>{TIMELINE[stageIndex].copy}</p>
            <div><i style={{ width: `${nationalProgress}%` }} /></div>
            <small>{nationalProgress.toFixed(1)}% OF THE PATH TO 270 · {map.organized.length} OF 51 ORGANIZED</small>
          </div>
        </section>

        <aside className={`systems-panel game-panel ${activeView === "upgrades" ? "mobile-active" : ""}`} data-testid="upgrades-view">
          <div className="system-tabs" role="tablist" aria-label="Game systems">
            <button className={systemTab === "field" ? "active" : ""} type="button" role="tab" aria-selected={systemTab === "field"} onClick={() => setSystemTab("field")} data-testid="tab-field">FIELD</button>
            <button className={systemTab === "mandates" ? "active" : ""} type="button" role="tab" aria-selected={systemTab === "mandates"} onClick={() => setSystemTab("mandates")} data-testid="tab-mandates">MANDATES <b>{state.mandates.length}/8</b></button>
            <button className={systemTab === "roadmap" ? "active" : ""} type="button" role="tab" aria-selected={systemTab === "roadmap"} onClick={() => setSystemTab("roadmap")}>ROADMAP</button>
          </div>

          <div className="system-scroll">
            {systemTab === "field" && (
              <div className="system-list" role="tabpanel">
                <div className="system-explainer"><strong>COMPOUNDING UPGRADES</strong><span>Every level grows faster. Building uses campaign time.</span></div>
                {FIELD_ACTIONS.map((action) => {
                  const level = state.upgrades[action.id] || 0;
                  const cost = upgradeCost(action, level);
                  const unlocked = state.totalMomentum >= action.unlock;
                  const nextRate = actionRateGain(action, level) * multiplier * campaignScale;
                  const oneBuildTime = upgradeTimeCost(level, 1);
                  const maxLevels = purchasableLevels(state, action, "max");
                  const canBuyOne = purchasableLevels(state, action, "one") > 0;
                  return (
                    <article className={`upgrade-row ${!unlocked ? "locked" : ""}`} key={action.id}>
                      <div className="upgrade-code"><span>{action.code}</span><b>LEVEL {level}</b></div>
                      <div className="upgrade-copy"><h3>{action.name}</h3><p>{unlocked ? action.detail : `Unlocks at ${formatNumber(action.unlock)} total momentum.`}</p></div>
                      <div className="upgrade-buy">
                        <span><small>{action.effect} · {formatCampaignClock(oneBuildTime)}</small>+{formatRate(nextRate)} ORG/DAY</span>
                        <button type="button" disabled={!canBuyOne} onClick={() => buyAction(action)} data-upgrade={action.id}><small>{unlocked ? "BUY 1" : ""}</small>{unlocked ? formatNumber(cost) : "LOCKED"}</button>
                        <button className="buy-max" type="button" disabled={maxLevels < 2} onClick={() => buyAction(action, "max")} data-upgrade-max={action.id}>{maxLevels >= 2 ? `MAX ×${maxLevels}` : "BUY MAX"}</button>
                      </div>
                      {valuePopup?.target === `field-${action.id}` && <output className="value-popup upgrade-popup" key={valuePopup.id}>{valuePopup.text}</output>}
                    </article>
                  );
                })}
              </div>
            )}

            {systemTab === "mandates" && (
              <div className="system-list" role="tabpanel">
                <div className="system-explainer"><strong>PERMANENT BOOSTS</strong><span>Fictional planks. Each one multiplies organizer training.</span></div>
                {MANDATES.map((mandate) => {
                  const ratified = state.mandates.includes(mandate.id);
                  return (
                    <article className={`upgrade-row mandate-row ${ratified ? "ratified" : ""}`} key={mandate.id}>
                      <div className="upgrade-code"><span>{mandate.number}</span><b>{mandate.short}</b></div>
                      <div className="upgrade-copy"><h3>{mandate.name}</h3><p>{mandate.promise}</p></div>
                      <div className="upgrade-buy">
                        <span><small>BOOST</small>×{mandate.boost.toFixed(2)}</span>
                        <button type="button" disabled={!canRatify(state, mandate.id)} onClick={() => ratifyMandate(mandate)} data-mandate={mandate.id}><small>{ratified ? "" : `COST · ${MANDATE_HOURS / 24} DAYS`}</small>{ratified ? "DONE" : formatNumber(mandate.cost)}</button>
                      </div>
                      {valuePopup?.target === `mandate-${mandate.id}` && <output className="value-popup upgrade-popup" key={valuePopup.id}>{valuePopup.text}</output>}
                    </article>
                  );
                })}
              </div>
            )}

            {systemTab === "roadmap" && (
              <div className="roadmap-list" role="tabpanel">
                <div className="system-explainer"><strong>WIN CONDITION</strong><span>Win 270 electoral votes before {CAMPAIGN_DAYS} campaign days expire.</span></div>
                {TIMELINE.map((item, index) => (
                  <article className={index <= stageIndex ? "reached" : ""} key={item.title}>
                    <div>{index <= stageIndex ? "✓" : String(index + 1).padStart(2, "0")}</div>
                    <span>{item.year}</span>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                    <small>{formatNumber(item.threshold)}</small>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      <footer className="fiction-strip" data-testid="fiction-strip">
        <b>A WORK OF FICTION</b>
        <span>No real party, candidate or campaign. Nothing here asks for money, sign-ups or votes.</span>
        <nav aria-label="About this game">
          <a href="guide/">GUIDE</a>
          <a href="about/">ABOUT</a>
          {config.supportUrl && <a href={config.supportUrl} rel="noopener" data-testid="support-link">{config.supportLabel}</a>}
        </nav>
      </footer>

      <nav className="mobile-nav" aria-label="Game views">
        <button className={activeView === "play" ? "active" : ""} type="button" onClick={() => setActiveView("play")} data-testid="nav-play"><span>★</span>PLAY</button>
        <button className={activeView === "upgrades" ? "active" : ""} type="button" onClick={() => setActiveView("upgrades")} data-testid="nav-upgrades"><span>▲</span>UPGRADES</button>
        <button className={activeView === "map" ? "active" : ""} type="button" onClick={() => setActiveView("map")} data-testid="nav-map"><span>◆</span>USA</button>
      </nav>

      {showHowToPlay && (
        <div className="intro-backdrop" role="presentation">
          <section className="intro-modal" role="dialog" aria-modal="true" aria-labelledby="intro-title" data-testid="intro">
            <span className="intro-label">YOUR ROLE // ORDINARY CITIZEN</span>
            <h2 id="intro-title">WIN 2028.<br /><em>START NEXT DOOR.</em></h2>
            {challengeDay && <p className="intro-challenge" data-testid="challenge">A friend won on campaign day <b>{challengeDay}</b>. Can you clinch 270 sooner?</p>}
            <div className="how-grid">
              <div><b>1</b><span><strong>CHOOSE</strong>Every door, DM, story, and upgrade uses campaign time.</span></div>
              <div><b>2</b><span><strong>CONVERT</strong>Refine the message until informed people believe.</span></div>
              <div><b>3</b><span><strong>WIN</strong>Organize states and reach 270 real electoral votes before Election Day.</span></div>
            </div>
            <button type="button" onClick={closeIntro} data-testid="intro-start">CHOOSE YOUR FIRST MOVE →</button>
            <p>A work of fiction. No party. No candidate. The shared to-do list is in charge. <a href="guide/">How the game works</a></p>
          </section>
        </div>
      )}

      {showSaveTools && (
        <div className="intro-backdrop" role="presentation">
          <section className="intro-modal save-modal" role="dialog" aria-modal="true" aria-labelledby="save-title" data-testid="save-tools">
            <span className="intro-label">YOUR SAVE // THIS BROWSER ONLY</span>
            <h2 id="save-title">MOVE YOUR<br /><em>CAMPAIGN.</em></h2>
            <p>Your run is saved in this browser and pauses while you are away. A save code carries it to another browser or device. No account, nothing uploaded.</p>
            <button type="button" onClick={copySaveCode} data-testid="copy-save">COPY SAVE CODE</button>
            <label htmlFor="save-code">PASTE A SAVE CODE</label>
            <textarea id="save-code" value={saveCode} onChange={(event) => setSaveCode(event.target.value)} rows={3} spellCheck={false} autoComplete="off" data-testid="save-code" />
            <div className="save-row">
              <button type="button" onClick={loadSaveCode} disabled={!saveCode.trim()} data-testid="load-save">LOAD THIS SAVE</button>
              <button type="button" className="secondary" onClick={() => setShowSaveTools(false)}>CLOSE</button>
            </div>
          </section>
        </div>
      )}

      {campaignOver && !resultDismissed && !showHowToPlay && (
        <div className="intro-backdrop election-backdrop" role="presentation">
          <section className={`intro-modal election-result ${outcome === "won" ? "won" : "lost"}`} role="dialog" aria-modal="true" aria-labelledby="election-title" data-testid="result">
            <span className="intro-label">2028 ELECTION NIGHT · A WORK OF FICTION</span>
            <h2 id="election-title">{outcome === "won" ? "YOU WON." : "TIME RAN OUT."}<br /><em data-testid="result-ev">{electoralVotes} ELECTORAL VOTES</em></h2>
            <p>
              {outcome === "won"
                ? `The citizen campaign crossed ${ELECTORAL_VOTES_TO_WIN} on campaign day ${result.day}, with ${formatCampaignClock(campaignHoursRemaining)} still on the clock.`
                : `Election Day arrived with ${ELECTORAL_VOTES_TO_WIN - electoralVotes} electoral votes still needed.`}
              {challengeDay && outcome === "won" && (result.day < challengeDay ? ` You beat your friend's day ${challengeDay}.` : ` Your friend's day ${challengeDay} still stands.`)}
            </p>
            <ResultPanel config={config} state={state} onNotice={setNotice} />
            <div className="result-actions">
              <button type="button" onClick={() => resetGame(true)} data-testid="play-again">PLAY AGAIN →</button>
              <button type="button" className="secondary" onClick={() => setResultDismissed(true)} data-testid="review">REVIEW THE {outcome === "won" ? "VICTORY" : "CAMPAIGN"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
