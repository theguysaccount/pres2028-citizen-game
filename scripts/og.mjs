// Render the 1200x630 share image (public/og.jpg) in headless Chrome from the game's own map.
//   node scripts/og.mjs
// The image is committed, so builds do not need Chrome. Re-run after changing the title or the map.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchChrome } from "./lib/cdp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const map = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "generated", "us-map.json"), "utf8"));
const font = (pkg, file) => pathToFileURL(path.join(ROOT, "node_modules", pkg, "files", file)).href;

// A decorative spread of organized states: every other shape in FIPS order, plus a few neighbours.
const lit = new Set(map.states.filter((_, index) => index % 2 === 0 || index % 7 === 3).map((state) => state.fips));
const shapes = map.states
  .map((state) => {
    const on = lit.has(state.fips);
    const fill = on ? "#e7b34c" : "#353049";
    const stroke = on ? "#fff0bd" : "#655e7b";
    const dot = on ? `<rect x="${state.cx - 2}" y="${state.cy - 2}" width="4" height="4" fill="#fff8df"/>` : "";
    return state.d
      ? `<path d="${state.d}" fill="${fill}" stroke="${stroke}" stroke-width="${on ? 1.2 : 0.8}"/>${dot}`
      : `<rect x="${state.cx - 3}" y="${state.cy - 3}" width="6" height="6" fill="${fill}"/>`;
  })
  .join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Geist Mono";src:url("${font("@fontsource-variable/geist-mono", "geist-mono-latin-wght-normal.woff2")}") format("woff2");font-weight:100 900}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:linear-gradient(rgba(23,21,43,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(23,21,43,.05) 1px,transparent 1px),#f4ecda;background-size:18px 18px;
 font-family:"Geist Mono",ui-monospace,monospace;color:#17152b;display:grid;grid-template-columns:520px 1fr;gap:0;box-sizing:border-box;padding:48px}
.left{display:flex;flex-direction:column;justify-content:space-between;padding-right:28px}
.mark{font-size:30px;font-weight:950;letter-spacing:.16em}.mark span{color:#65449b}.mark small{font-size:15px;letter-spacing:.09em}
h1{margin:0;font-size:92px;line-height:.9;letter-spacing:-.08em;font-weight:950}h1 em{color:#65449b;font-style:normal;display:block}
p{margin:0;font-family:Georgia,serif;font-size:27px;line-height:1.3;color:#3f3a3c}
.foot{font-size:15px;font-weight:900;letter-spacing:.06em;color:#7b746f}
.panel{background:#17152b;border:4px solid #17152b;box-shadow:12px 12px 0 #e7b34c;display:grid;place-items:center;position:relative}
.panel b{position:absolute;left:20px;top:16px;color:#e7b34c;font-size:16px;letter-spacing:.12em}
.panel strong{position:absolute;right:20px;top:10px;color:#ffe4a0;font-size:38px;letter-spacing:-.06em}
.panel strong small{font-size:15px;color:#aaa2b9;letter-spacing:.04em}
svg{width:96%;height:auto;margin-top:30px;shape-rendering:crispEdges}
</style></head><body>
<div class="left"><div class="mark">PRES<span>2028</span><small> / CITIZEN</small></div>
<div><h1>THE ROAD<em>TO 270.</em></h1></div>
<p>Knock a door. DM a friend. Post a story. Organize the states, one conversation at a time.</p>
<div class="foot">A FREE, FICTIONAL CAMPAIGN GAME<br>NO PARTY · NO CANDIDATE</div></div>
<div class="panel"><b>2028 ELECTORAL MAP</b><strong>270<small> TO WIN</small></strong>
<svg viewBox="0 0 ${map.width} ${map.height}" xmlns="http://www.w3.org/2000/svg">${shapes}</svg></div>
</body></html>`;

const work = fs.mkdtempSync(path.join(os.tmpdir(), "og-"));
const file = path.join(work, "og.html");
fs.writeFileSync(file, html);
const browser = await launchChrome();
try {
  const page = await browser.newPage({ width: 1200, height: 630 });
  await page.goto(pathToFileURL(file).href, { settle: 800 });
  await page.eval("document.fonts.ready.then(() => true)");
  const { data } = await page.call("Page.captureScreenshot", { format: "jpeg", quality: 86 });
  fs.writeFileSync(path.join(ROOT, "public", "og.jpg"), Buffer.from(data, "base64"));
  console.log(`wrote public/og.jpg (${(fs.statSync(path.join(ROOT, "public", "og.jpg")).size / 1024).toFixed(0)} KB)`);
} finally {
  await browser.close();
  fs.rmSync(work, { recursive: true, force: true });
}
