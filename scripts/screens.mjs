// Screenshots of the key screens at desktop (1366 px) and phone (390 px, real mobile emulation) into
// docs/screens/. Mid-campaign and finished states come from the scripted player, so they are real states.
//   node scripts/screens.mjs                    from dist/, served locally
//   node scripts/screens.mjs https://host/path/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChrome } from "./lib/cdp.mjs";
import { startServer } from "./serve.mjs";
import { INTRO_KEY, STORAGE_KEY } from "../src/engine.ts";
import { simulateCampaign } from "../src/bot.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screens");
const target = process.argv[2];
const local = target ? null : await startServer({ basePath: "/pres2028-citizen-game/" });
const base = (target || local.url).replace(/\/*$/, "/");

const midCampaign = simulateCampaign("casual", 470).states;
const finished = simulateCampaign("planner").states;

// [file name, page, query, save, intro seen?, width, height, phone?, click before the shot]
const shots = [
  ["intro-desktop", "", "", null, false, 1366, 860, false],
  ["play-desktop", "", "", midCampaign, true, 1366, 860, false],
  ["play-phone", "", "", midCampaign, true, 390, 844, true],
  ["map-phone", "", "", midCampaign, true, 390, 844, true, '[data-testid="nav-map"]'],
  ["upgrades-phone", "", "", midCampaign, true, 390, 844, true, '[data-testid="nav-upgrades"]'],
  ["result-desktop", "", "", finished, true, 1366, 860, false],
  ["result-phone", "", "", finished, true, 390, 844, true],
  ["challenge-phone", "", "&day=180", null, false, 390, 844, true],
  ["guide-desktop", "guide/", "", null, true, 1280, 1000, false],
  ["about-phone", "about/", "", null, true, 390, 844, true],
];

fs.mkdirSync(OUT, { recursive: true });
const browser = await launchChrome();
const overflow = [];
try {
  for (const [name, pagePath, query, save, introSeen, width, height, mobile, click] of shots) {
    const page = await browser.newPage({ width, height, mobile });
    // Seed storage from a page without the game on it: the game writes its own state when it closes.
    await page.goto(`${base}about/`);
    await page.eval(`(() => {
      localStorage.clear();
      ${save ? `localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(save))});` : ""}
      ${introSeen ? `localStorage.setItem(${JSON.stringify(INTRO_KEY)}, "seen");` : ""}
    })()`);
    await page.goto(`${base}${pagePath}?shot=${name}${query}`, { settle: 900 });
    if (click) {
      await page.eval(`document.querySelector(${JSON.stringify(click)})?.click()`);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    const wide = await page.eval("document.documentElement.scrollWidth - window.innerWidth");
    if (wide > 1) overflow.push(`${name}: ${wide}px wider than the screen`);
    await page.screenshot(path.join(OUT, `${name}.png`));
    console.log(`saved docs/screens/${name}.png`);
    if (name === "result-desktop") {
      const png = await page.eval(`document.querySelector('[data-testid="result-card"]')?.toDataURL("image/png") || ""`);
      if (png.startsWith("data:image/png;base64,")) {
        fs.writeFileSync(path.join(OUT, "result-card.png"), Buffer.from(png.split(",")[1], "base64"));
        console.log("saved docs/screens/result-card.png");
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  if (local) await local.close();
}
if (overflow.length) {
  console.log(`SIDEWAYS SCROLL:\n  ${overflow.join("\n  ")}`);
  process.exitCode = 1;
}
