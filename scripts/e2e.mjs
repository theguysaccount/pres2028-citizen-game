// End-to-end campaign in headless Chrome: a scripted player presses the real buttons from a blank save to
// Election Night, then checks the result card and challenge link, reload, save codes, the paused clock, the
// phone views, the reading pages and the 404 page.
//   node scripts/e2e.mjs                         serve dist/ and test it
//   node scripts/e2e.mjs https://host/path/      test a deployed site
import { launchChrome } from "./lib/cdp.mjs";
import { startServer } from "./serve.mjs";
import { ELECTORAL_VOTES_TO_WIN, STATES, STORAGE_KEY, campaignDayFor } from "../src/engine.ts";

const target = process.argv[2];
const local = target ? null : await startServer({ basePath: "/pres2028-citizen-game/" });
const base = (target || local.url).replace(/\/*$/, "/");
const failures = [];
const check = (condition, message) => {
  console.log(`${condition ? "ok  " : "FAIL"} ${message}`);
  if (!condition) failures.push(message);
};
const text = (selector) => `(document.querySelector(${JSON.stringify(selector)})?.textContent || "").trim()`;
const overflow = "document.documentElement.scrollWidth - window.innerWidth";
const tick = "new Promise((resolve) => setTimeout(resolve, 0))";

// Runs inside the page: play to the end of the campaign using only the visible buttons.
const PLAY = `(async () => {
  const q = (selector) => document.querySelector(selector);
  const wait = () => new Promise((resolve) => setTimeout(resolve, 0));
  const cost = (button) => Number((button.textContent.match(/[\\d,]+$/) || ["0"])[0].replace(/,/g, "")) || 0;
  const order = ["door", "story", "dm"];
  let moves = 0;
  for (let step = 0; step < 6000 && !q('[data-testid="result"]'); step += 1) {
    q('[data-testid="tab-mandates"]').click();
    await wait();
    const mandate = q("[data-mandate]:not(:disabled)");
    if (mandate) { mandate.click(); moves += 1; await wait(); continue; }
    q('[data-testid="tab-field"]').click();
    await wait();
    const upgrades = [...document.querySelectorAll("[data-upgrade]:not(:disabled)")].sort((a, b) => cost(a) - cost(b));
    if (upgrades.length && step % 3 === 2) { upgrades[0].click(); moves += 1; await wait(); continue; }
    const move = q('[data-testid="outreach-' + order[step % 3] + '"]:not(:disabled)');
    if (!move) break;
    move.click();
    moves += 1;
    await wait();
  }
  return { moves, done: Boolean(q('[data-testid="result"]')) };
})()`;

const browser = await launchChrome();
try {
  const stubTelemetry = async (p) => {
    if (!local) return;
    await p.call("Fetch.enable", { patterns: [{ urlPattern: "https://rsio.org/*" }] });
    p.onEvent?.((msg) => {
      if (msg.method === "Fetch.requestPaused") {
        p.call("Fetch.fulfillRequest", {
          requestId: msg.params.requestId,
          responseCode: 204,
          responseHeaders: [{ name: "Access-Control-Allow-Origin", value: "*" }],
          body: "",
        }).catch(() => {});
      }
    });
  };
  const page = await browser.newPage({ width: 1366, height: 900 });
  await stubTelemetry(page);
  await page.goto(base);

  // ---- First visit ----
  check((await page.eval("document.title")).includes("PRES2028"), "the game page loads with its title");
  check(await page.eval('Boolean(document.querySelector(\'[data-testid="intro"]\'))'), "a first visit shows how to play");
  check((await page.eval(text('[data-testid="fiction-strip"]'))).includes("A WORK OF FICTION"), "the fiction strip is on screen");
  check((await page.eval(text('[data-testid="intro"]'))).includes("No party. No candidate."), "the intro says there is no party or candidate");
  await page.eval(`document.querySelector('[data-testid="intro-start"]').click(); ${tick}`);
  check(!(await page.eval('Boolean(document.querySelector(\'[data-testid="intro"]\'))')), "the intro closes");
  check((await page.eval(text('[data-testid="campaign-day"]'))) === "DAY 1 / 730", "a new campaign starts on day 1");
  check((await page.eval(text('[data-testid="ev-count"]'))).startsWith("0"), "a new campaign has no electoral votes");
  check((await page.eval('document.querySelectorAll(\'[data-testid="usa-map"] g.state\').length')) === STATES.length, "the map draws all 50 states and DC");

  // ---- First moves ----
  await page.eval(`document.querySelector('[data-testid="outreach-story"]').click(); ${tick}`);
  check(Number((await page.eval(text('[data-testid="momentum"]'))).replace(/[^\d.]/g, "")) > 0, "a story earns momentum");
  check((await page.eval(text('[data-testid="campaign-day"]'))) === "DAY 1 / 730", "two hours keep the clock on day 1");
  const afterStory = JSON.parse(await page.eval(`localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || "{}"`));
  await page.eval(`new Promise((resolve) => setTimeout(resolve, 400))`);
  const saved = JSON.parse(await page.eval(`localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || "{}"`));
  check(saved.campaignHours === 2 && saved.moves === 1, "the move is saved in the browser");

  // ---- The clock is paused while away ----
  await page.goto(base);
  check((await page.eval(text('[data-testid="notice"]'))).includes("paused"), "coming back says the campaign was paused");
  const reloaded = JSON.parse(await page.eval(`localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`));
  check(reloaded.campaignHours === 2, "no campaign time passes while away");
  check(!(await page.eval('Boolean(document.querySelector(\'[data-testid="intro"]\'))')), "the intro is not shown again");
  void afterStory;

  // ---- The whole campaign ----
  const started = Date.now();
  const run = await page.eval(PLAY);
  console.log(`     scripted campaign: ${run.moves} moves in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  check(run.done, "the campaign reaches Election Night");
  const result = await page.eval(text('[data-testid="result"]'));
  check(result.includes("YOU WON"), "the scripted player wins");
  const ev = Number(((await page.eval(text('[data-testid="result-ev"]'))).match(/\d+/) || ["0"])[0]);
  check(ev >= ELECTORAL_VOTES_TO_WIN, `the result shows at least 270 electoral votes (${ev})`);
  const finalSave = JSON.parse(await page.eval(`localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`));
  const day = campaignDayFor(finalSave.campaignHours);
  check(finalSave.moves >= run.moves, "the finished campaign is saved");
  for (let wait = 0; wait < 30; wait += 1) {
    if ((await page.eval('document.querySelector(\'[data-testid="result-card"]\')?.dataset.drawn')) === "yes") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const colours = await page.eval(`(() => {
    const canvas = document.querySelector('[data-testid="result-card"]');
    if (!canvas || canvas.dataset.drawn !== "yes") return 0;
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 97) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    return seen.size;
  })()`);
  check(colours > 8, `the result card is drawn (${colours} colours sampled)`);
  const link = await page.eval('document.querySelector(\'[data-testid="share-link"]\')?.href || ""');
  check(new URL(link || "http://x/").searchParams.get("day") === String(day), `the challenge link carries the winning day (${day})`);
  check(await page.eval('document.querySelector(\'[data-testid="outreach-door"]\').disabled'), "moves stop after Election Night");

  // ---- Reload, review, challenge link, play again ----
  await page.goto(base);
  check(await page.eval('Boolean(document.querySelector(\'[data-testid="result"]\'))'), "a reload brings back the result");
  await page.eval(`document.querySelector('[data-testid="review"]').click(); ${tick}`);
  check(!(await page.eval('Boolean(document.querySelector(\'[data-testid="result"]\'))')), "the result can be closed to review the map");
  check((await page.eval('document.querySelectorAll(\'[data-testid="usa-map"] g.organized\').length')) >= 20, "the map shows the organized states");
  // Clear storage from a page without the game on it: the game writes its own state when it closes.
  await page.goto(`${base}about/`);
  await page.eval("localStorage.clear()");
  await page.goto(`${base}?day=${day + 5}`);
  check((await page.eval(text('[data-testid="challenge"]'))).includes(String(day + 5)), "a challenge link shows the day to beat");
  await page.eval(`document.querySelector('[data-testid="intro-start"]').click(); ${tick}`);
  check((await page.eval(text('[data-testid="campaign-day"]'))) === "DAY 1 / 730", "a challenger starts a fresh campaign");

  // ---- Save codes ----
  const code = "P28." + Buffer.from(JSON.stringify({ ...finalSave, momentum: 4321 })).toString("base64");
  await page.eval(`(async () => {
    document.querySelector('[data-testid="open-save"]').click();
    await ${tick};
    const area = document.querySelector('[data-testid="save-code"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(area, ${JSON.stringify(code)});
    area.dispatchEvent(new Event("input", { bubbles: true }));
    await ${tick};
    document.querySelector('[data-testid="load-save"]').click();
    await ${tick};
  })()`);
  check(await page.eval('Boolean(document.querySelector(\'[data-testid="result"]\'))'), "a pasted save code loads the finished campaign");
  await page.eval(`(async () => {
    document.querySelector('[data-testid="play-again"]').click();
    await ${tick};
    document.querySelector('[data-testid="open-save"]').click();
    await ${tick};
    const area = document.querySelector('[data-testid="save-code"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(area, "P28.broken");
    area.dispatchEvent(new Event("input", { bubbles: true }));
    await ${tick};
    document.querySelector('[data-testid="load-save"]').click();
    await ${tick};
  })()`);
  check((await page.eval(text('[data-testid="notice"]'))).includes("COULD NOT BE READ"), "a broken save code is refused");
  check((await page.eval(text('[data-testid="campaign-day"]'))) === "DAY 1 / 730", "play again starts a fresh campaign");
  check((await page.eval(overflow)) <= 1, "no sideways scroll at desktop width");
  check(page.problems.length === 0, `no console errors on the game page${page.problems.length ? ": " + page.problems.slice(0, 3).join(" | ") : ""}`);
  await page.close();

  // ---- Phone ----
  const phone = await browser.newPage({ width: 390, height: 844, mobile: true });
  await stubTelemetry(phone);
  await phone.goto(base);
  await phone.eval(`document.querySelector('[data-testid="intro-start"]')?.click(); ${tick}`);
  check((await phone.eval(overflow)) <= 1, "no sideways scroll on a phone");
  const visible = (selector) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom <= window.innerHeight + 1; })()`;
  check(await phone.eval(visible('[data-testid="outreach-door"]')), "the outreach buttons fit the phone screen");
  check(await phone.eval(visible('[data-testid="nav-map"]')), "the phone tab bar is on screen");
  await phone.eval(`document.querySelector('[data-testid="nav-map"]').click(); ${tick}`);
  check(await phone.eval(visible('[data-testid="usa-map"]')), "the USA tab shows the map");
  await phone.eval(`document.querySelector('[data-testid="nav-upgrades"]').click(); ${tick}`);
  check(await phone.eval(visible("[data-upgrade]")), "the upgrades tab shows the upgrades");
  await phone.goto(`${base}guide/`);
  check((await phone.eval("document.querySelectorAll('.doc-table')[0].querySelectorAll('tbody tr').length")) === STATES.length, "the guide lists every state and DC");
  check((await phone.eval(overflow)) <= 1, "the guide has no sideways scroll on a phone");
  check((await phone.eval("window.scrollY !== undefined && document.documentElement.scrollHeight > window.innerHeight")), "the guide scrolls");
  await phone.goto(`${base}about/`);
  check((await phone.eval(text("#fiction + p"))).includes("not"), "the about page states that the game is fiction");
  check(phone.problems.length === 0, `no console errors on a phone${phone.problems.length ? ": " + phone.problems.slice(0, 3).join(" | ") : ""}`);
  await phone.close();

  const missing = await fetch(`${base}this-page-does-not-exist/`);
  check(missing.status === 404 && (await missing.text()).includes("PLAY PRES2028"), "unknown addresses get the 404 page with a way back");
} finally {
  await browser.close();
  if (local) await local.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nall checks passed for ${base}`);
