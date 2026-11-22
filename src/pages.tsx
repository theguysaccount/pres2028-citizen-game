// The guide and about pages, rendered to plain HTML at build time (no script). Every number on the guide is
// computed from engine.ts, states.ts or the scripted players in bot.ts, so the page stays true after a rebalance.
import type { ReactNode } from "react";
import {
  CAMPAIGN_DAYS,
  CAMPAIGN_SCALE_BASE,
  ELECTORAL_VOTES_TO_WIN,
  FIELD_ACTIONS,
  MANDATES,
  MANDATE_HOURS,
  OUTREACH_MOVES,
  STATE_ORDER,
  STATES,
  TIMELINE,
  TOTAL_ELECTORAL_VOTES,
  actionRateAtLevel,
  formatNumber,
  formatRate,
  organizersToHold,
  upgradeTimeCost,
} from "./engine.ts";
import { simulateCampaign } from "./bot.ts";
import type { SiteConfig } from "./config.ts";

function DocShell({ config, label, children }: { config: SiteConfig; label: string; children: ReactNode }) {
  return (
    <div className="doc-shell">
      <header className="doc-top">
        <a className="wordmark" href="../" aria-label="PRES2028: Citizen, play the game">PRES<span>2028</span><small>/ CITIZEN</small></a>
        <nav aria-label="Site">
          <a href="../guide/">GUIDE</a>
          <a href="../about/">ABOUT</a>
          <a className="play-link" href="../">PLAY →</a>
        </nav>
      </header>
      <main className="doc">
        <span className="doc-label">{label}</span>
        {children}
        <p><a className="play-link" href="../">PLAY PRES2028: CITIZEN →</a></p>
      </main>
      <footer className="doc-foot">
        A WORK OF FICTION. No real party, candidate or campaign; not affiliated with any party, candidate, campaign,
        committee or government. Nothing in the game asks for money, sign-ups or votes. ·{" "}
        <a href={config.repoUrl} rel="noopener">Source code</a>
        {config.supportUrl ? (
          <>
            {" · "}
            <a href={config.supportUrl} rel="noopener">{config.supportLabel}</a>
          </>
        ) : null}
      </footer>
    </div>
  );
}

const MOVE_NAMES: Record<string, string> = { door: "knock a door", dm: "DM a friend", story: "post a story" };

// The scripted players' results, shared by the guide and its FAQ.
function campaignTimes() {
  return { planner: simulateCampaign("planner"), casual: simulateCampaign("casual"), talker: simulateCampaign("talker") };
}

// Electoral facts computed from the state table.
function electoralFacts() {
  let votes = 0;
  let smallestFirst = 0;
  let includesDc = false;
  for (const state of STATE_ORDER) {
    votes += state.ev;
    if (state.abbr === "DC") includesDc = true;
    else smallestFirst += 1;
    if (votes >= ELECTORAL_VOTES_TO_WIN) break;
  }
  const largest = [...STATES].filter((state) => state.abbr !== "DC").sort((a, b) => b.ev - a.ev || a.name.localeCompare(b.name));
  let bigVotes = 0;
  let largestFirst = 0;
  for (const state of largest) {
    bigVotes += state.ev;
    largestFirst += 1;
    if (bigVotes >= ELECTORAL_VOTES_TO_WIN) break;
  }
  const smallest = Math.min(...STATES.map((state) => state.ev));
  const minimumStates = STATES.filter((state) => state.ev === smallest);
  return { smallestFirst, includesDc, smallestFirstVotes: votes, largestFirst, largestFirstVotes: bigVotes, largest: largest[0], smallest, minimumStates };
}

function aboutMinutes(moves: number, secondsPerMove: number) {
  return Math.max(1, Math.round((moves * secondsPerMove) / 60));
}

export function buildFaq(): { question: string; answer: string }[] {
  const { planner, casual } = campaignTimes();
  return [
    {
      question: "Is PRES2028: Citizen a real campaign?",
      answer: "No. It is a work of fiction: a strategy game about party-less, peaceful organizing. There is no real party, candidate or campaign behind it, and nothing in it asks for money, sign-ups or votes. The platform planks in the game are fictional mechanics, not pledges.",
    },
    {
      question: "How do you win?",
      answer: `Organize enough states to hold ${ELECTORAL_VOTES_TO_WIN} of the ${TOTAL_ELECTORAL_VOTES} electoral votes before the ${CAMPAIGN_DAYS} campaign days run out. Every outreach move, upgrade and mandate uses campaign time.`,
    },
    {
      question: "How long does a game take?",
      answer: `A player who follows the missions and buys the cheapest upgrade now and then wins in about ${formatNumber(casual.moves)} moves, around ${aboutMinutes(casual.moves, 2.5)} minutes at a relaxed pace. A planned run wins in about ${formatNumber(planner.moves)} moves. These numbers are recomputed from the game's rules every time the site is built.`,
    },
    {
      question: "Are the electoral votes real?",
      answer: `Yes. Each state carries its real number of electoral votes for the 2024 and 2028 elections, as set after the 2020 Census (${TOTAL_ELECTORAL_VOTES} in all, ${ELECTORAL_VOTES_TO_WIN} to win), from the U.S. National Archives. What it takes to "organize" a state is a game rule, not a forecast.`,
    },
    {
      question: "Does time pass while I am away?",
      answer: "No. Campaign time only moves when you act, so the game pauses whenever you leave. Your campaign is saved in your own browser; a save code moves it to another device.",
    },
    {
      question: "Is it free? Do I need an account?",
      answer: "It is free, with no account, no ads and no download. It runs in any modern browser on a phone or a computer.",
    },
  ];
}

export function GuidePage({ config }: { config: SiteConfig }) {
  const { planner, casual, talker } = campaignTimes();
  const facts = electoralFacts();
  const faq = buildFaq();
  let cumulative = 0;
  let crossed = false;

  return (
    <DocShell config={config} label="GUIDE">
      <h1>How to play PRES2028: Citizen, the electoral college game</h1>
      <p className="doc-lede">
        PRES2028: Citizen is a free strategy game. You are an ordinary citizen with no party and no candidate, and you
        have {CAMPAIGN_DAYS} campaign days to organize enough states to win {ELECTORAL_VOTES_TO_WIN} electoral votes. Every
        state carries its real electoral votes. This page explains the rules, the map and the numbers behind them.
      </p>
      <p className="doc-note">The game is a work of fiction. There is no real party, candidate or campaign behind it.</p>

      <h2 id="loop">The loop: reach, belief, organizers</h2>
      <ol>
        <li><b>Reach people.</b> Each move uses campaign hours: {OUTREACH_MOVES.map((move) => `${MOVE_NAMES[move.id]} (${move.hours} h)`).join(", ")}.</li>
        <li><b>Turn reach into belief.</b> Stories reach many people. DMs and door knocks reach one, but more of them believe.</li>
        <li><b>Turn believers into organizers.</b> Organizers earn momentum. Field upgrades also train new organizers every campaign day.</li>
        <li><b>Spend momentum.</b> Upgrades and mandates cost momentum <em>and</em> campaign time: an upgrade's first level takes {upgradeTimeCost(0, 1)} hours to build, and each mandate takes {MANDATE_HOURS / 24} days to ratify.</li>
        <li><b>Organize states.</b> Enough organizers organize the next state, which adds its electoral votes.</li>
      </ol>

      <h2 id="electoral-college">How 270 works</h2>
      <p>
        The real Electoral College has {TOTAL_ELECTORAL_VOTES} electors: one for each of the 435 members of the House, one for
        each of the 100 senators, and 3 for the District of Columbia. A majority is {ELECTORAL_VOTES_TO_WIN}. Every state has at
        least {facts.smallest} electoral votes ({facts.minimumStates.length} jurisdictions have exactly {facts.smallest}), and{" "}
        {facts.largest.name} has the most, with {facts.largest.ev}.
      </p>
      <ul>
        <li>Starting from the largest states, {facts.largestFirst} states are enough to pass {ELECTORAL_VOTES_TO_WIN} ({facts.largestFirstVotes} votes).</li>
        <li>Starting from the smallest delegations, as the organizers in this game do, it takes {facts.smallestFirst} states{facts.includesDc ? " plus DC" : ""} ({facts.smallestFirstVotes} votes).</li>
      </ul>
      <p>
        In the game, your organizers reach the smallest delegations first, because they need the fewest people. Each new state
        needs more organizers per electoral vote than the last, so the campaign speeds up early and gets harder as it grows.
      </p>

      <h2 id="map">Every state, in the order the campaign reaches it</h2>
      <div className="doc-table">
        <table>
          <thead>
            <tr><th>#</th><th>State</th><th>Electoral votes</th><th>Running total</th><th>Organizers needed in all</th></tr>
          </thead>
          <tbody>
            {STATE_ORDER.map((state, index) => {
              cumulative += state.ev;
              const isWinLine = !crossed && cumulative >= ELECTORAL_VOTES_TO_WIN;
              if (isWinLine) crossed = true;
              return (
                <tr key={state.fips} className={isWinLine ? "win-line" : undefined}>
                  <td>{index + 1}</td>
                  <th scope="row">{state.name}</th>
                  <td>{state.ev}</td>
                  <td>{cumulative}{isWinLine ? " ← 270" : ""}</td>
                  <td>{formatNumber(organizersToHold(cumulative))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        Source for the electoral votes: U.S. National Archives,{" "}
        <a href="https://www.archives.gov/electoral-college/allocation" rel="noopener">Distribution of Electoral Votes</a> (2024 and 2028 elections).
      </p>

      <h2 id="upgrades">Field upgrades</h2>
      <p>Each level costs {"×"}1.58 the last and trains organizers faster than the level before. Building takes campaign time.</p>
      <div className="doc-table">
        <table>
          <thead>
            <tr><th>Upgrade</th><th>Unlocks at (total momentum)</th><th>First level costs</th><th>Organizers per day, level 1</th><th>What it does</th></tr>
          </thead>
          <tbody>
            {FIELD_ACTIONS.map((action) => (
              <tr key={action.id}>
                <th scope="row">{action.name}</th>
                <td>{formatNumber(action.unlock)}</td>
                <td>{formatNumber(action.baseCost)}</td>
                <td>{formatRate(actionRateAtLevel(action, 1))}</td>
                <td>{action.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="mandates">Mandates (fictional platform planks)</h2>
      <p>Each mandate is a permanent multiplier on organizer training. They are invented for the game and are nobody's pledge.</p>
      <div className="doc-table">
        <table>
          <thead>
            <tr><th>Mandate</th><th>In the game</th><th>Costs</th><th>Multiplier</th></tr>
          </thead>
          <tbody>
            {MANDATES.map((mandate) => (
              <tr key={mandate.id}>
                <th scope="row">{mandate.name}</th>
                <td>{mandate.promise}</td>
                <td>{formatNumber(mandate.cost)}</td>
                <td>×{mandate.boost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="levels">Campaign levels</h2>
      <p>Total momentum moves the campaign through eight levels. Each level multiplies everything by {CAMPAIGN_SCALE_BASE}.</p>
      <div className="doc-table">
        <table>
          <thead>
            <tr><th>Level</th><th>Era</th><th>Total momentum</th><th>Output multiplier</th></tr>
          </thead>
          <tbody>
            {TIMELINE.map((stage, index) => (
              <tr key={stage.title}>
                <td>{index + 1}</td>
                <th scope="row">{stage.title}</th>
                <td>{formatNumber(stage.threshold)}</td>
                <td>×{formatRate(Math.pow(CAMPAIGN_SCALE_BASE, index))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="length">How long a campaign takes</h2>
      <p>These results come from scripted players that run on the real rules each time this site is built.</p>
      <div className="doc-table">
        <table>
          <thead>
            <tr><th>Play style</th><th>Result</th><th>Moves</th><th>Campaign day</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Planned: ratifies every mandate, buys the best upgrade per momentum</th><td>{planner.outcome === "won" ? "Won" : "Lost"} ({planner.electoralVotes} EV)</td><td>{formatNumber(planner.moves)}</td><td>{planner.day}</td></tr>
            <tr><th scope="row">Casual: follows the missions, buys the cheapest upgrade now and then</th><td>{casual.outcome === "won" ? "Won" : "Lost"} ({casual.electoralVotes} EV)</td><td>{formatNumber(casual.moves)}</td><td>{casual.day}</td></tr>
            <tr><th scope="row">Only knocks doors, never builds anything</th><td>{talker.outcome === "won" ? "Won" : "Lost"} ({talker.electoralVotes} EV)</td><td>{formatNumber(talker.moves)}</td><td>{talker.day}</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li><b>Build early.</b> Organizers trained per day compound, and time spent building still trains them.</li>
        <li><b>Take the Story Camera Kit soon.</b> With permission, each door conversation also becomes a story.</li>
        <li><b>Ratify mandates when you can afford them.</b> A multiplier on everything beats one more level of anything.</li>
        <li><b>Mind the clock.</b> Your score is the campaign day you clinch 270. Lower is better.</li>
      </ul>

      <h2 id="faq">Questions</h2>
      <dl className="doc-faq">
        {faq.map((item) => (
          <div key={item.question}>
            <dt>{item.question}</dt>
            <dd>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </DocShell>
  );
}

export function AboutPage({ config }: { config: SiteConfig }) {
  const embed = `<iframe src="${config.siteUrl}/" title="PRES2028: Citizen" width="100%" height="720" style="border:0;max-width:1280px" loading="lazy"></iframe>`;
  return (
    <DocShell config={config} label="ABOUT">
      <h1>About PRES2028: Citizen</h1>
      <p className="doc-lede">
        A retro incremental strategy game about peaceful, party-less organizing. Start with one conversation, build a field
        operation, and race the clock to {ELECTORAL_VOTES_TO_WIN} electoral votes.
      </p>

      <h2 id="fiction">A work of fiction</h2>
      <p>
        This is a game. It is <b>not</b> a campaign, and it is not affiliated with, paid for by or endorsed by any party,
        candidate, campaign, committee or government. It promotes no real person. The &ldquo;mandates&rdquo; are invented game
        mechanics, not pledges, and the campaign in the game is imaginary. The game takes no donations, collects no sign-ups
        or contact details, and never contacts voters. Nothing here is legal or political advice.
      </p>

      <h2 id="privacy">Privacy</h2>
      <ul>
        <li>No account, no cookies, no ads.</li>
        <li>Your campaign is saved in your browser&apos;s local storage on your own device and is never uploaded.</li>
        <li>The result card is drawn on your device. A challenge link carries one number: the campaign day you won on.</li>
        <li>{config.goatcounterUrl ? "Visits and a few game events (campaign started, level reached, won or lost, card shared) are counted without cookies or personal data, using GoatCounter." : "Nothing is counted or tracked: this site loads no analytics."}</li>
        <li>The site is hosted on GitHub Pages, which keeps standard server logs.</li>
      </ul>

      <h2 id="embed">Put the game on your own page</h2>
      <p>Teachers and writers can embed the game. Saves in an embedded copy stay in each visitor&apos;s browser.</p>
      <pre className="doc-code"><code>{embed}</code></pre>

      <h2 id="credits">Credits and sources</h2>
      <ul>
        <li>Electoral votes: U.S. National Archives, <a href="https://www.archives.gov/electoral-college/allocation" rel="noopener">Distribution of Electoral Votes</a>.</li>
        <li>Map shapes: <a href="https://github.com/topojson/us-atlas" rel="noopener">us-atlas</a> (ISC licence), from U.S. Census Bureau cartographic boundary files.</li>
        <li>Typefaces: Geist and Geist Mono, SIL Open Font License 1.1.</li>
        <li>Game code: MIT licence. <a href={config.repoUrl} rel="noopener">Source on GitHub</a>.</li>
      </ul>

      <h2 id="contact">Bugs and balance</h2>
      <p>Open an issue on the <a href={`${config.repoUrl}/issues`} rel="noopener">project&apos;s issue tracker</a>.</p>

      {config.moreGames.length > 0 && (
        <>
          <h2 id="more">More games in this line</h2>
          <ul>
            {config.moreGames.map((game) => (
              <li key={game.url}><a href={game.url} rel="noopener">{game.name}</a>: {game.blurb}</li>
            ))}
          </ul>
        </>
      )}
    </DocShell>
  );
}
