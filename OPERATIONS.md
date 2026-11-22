# Operations

PRES2028: Citizen runs itself on GitHub. Pages hosts it, and Actions runs every recurring job. The game is static: no server, no database, no accounts. Each campaign is saved in the player's own browser and pauses while they are away. Nothing here needs a person for the site to keep working.

- **Live:** https://theguysaccount.github.io/pres2028-citizen-game/
- **Repo:** https://github.com/theguysaccount/pres2028-citizen-game
- **Indexed:** yes. The game is not served anywhere else. On 2026-11-22, pres2028.com, pres2032.com and president28.com each served a different site (leadership and initiative pages, not this game). The other owned names showed Namecheap parking pages. Nothing here duplicates those sites, and nothing links to them.

## Automated jobs

| Job | Workflow | When | What it does | How it fails safe |
|---|---|---|---|---|
| Deploy | `pages.yml` | Every push to `main` that touches the game, or by hand. The self-test also calls it when the live site falls behind `main`. | Type check and unit tests (rules, saves, the real electoral table, scripted players), then the build and rendered-HTML tests. Next, a full scripted campaign in headless Chrome to Election Night, then the deploy. After that it waits for the new build to be live, checks it, plays a campaign on it, and pings IndexNow. | A failed check stops the run before the deploy, so the last good site stays live. IndexNow problems are warnings only. Re-running is always safe. |
| Weekly self-test | `selftest.yml` | Thursdays 08:37 UTC, or by hand. GitHub often starts this account's schedules hours late; nothing depends on the exact time. | Unit tests, rendered-HTML tests and the scripted campaign on a fresh build of `main`. The health check and the campaign on the **live** site. A staleness check that asks `pages.yml` for a fresh deploy if the live build is behind the last change to the game. | Read-only apart from that one dispatch. A failure opens or updates one `ops-alert` issue, and GitHub emails the repository owner. A later pass closes the issue. |
| Keep-alive | `selftest.yml` → `scripts/keepalive.sh` | Weekly, even when the self-test fails | Re-enables every scheduled workflow. Pushes an empty `[skip ci]` commit after 45 quiet days. | GitHub disables schedules after 60 days without repository activity. |

`selftest.yml` also carries a temporary launch-proof schedule (`29 */2 22,23 11 *`). It can only fire on 22 and 23 November and should be deleted after the first scheduled pass.

### What each check means

- **`scripts/check-live.mjs`** checks:
  - Every sitemap page answers 200 with its own canonical and the right robots tag.
  - The page carries the server-rendered map with all 51 shapes.
  - The script, stylesheet, share image, robots.txt, IndexNow key file and 404 page are served.
- **`scripts/e2e.mjs`** runs a scripted player that presses the real buttons from a blank save to Election Night and wins. It then checks:
  - the result card and the `?day=` challenge link;
  - that a reload brings the result back, and the review screen;
  - that the challenge intro appears;
  - save codes, both good and broken;
  - the paused clock across a reload;
  - the phone tab views, the reading pages, the 404 page and the browser console.
- **`tests/engine.test.ts`** covers the rules and the real electoral table (51 entries, 538 votes, 270 to win), and that the map has a shape for every state. It also asserts the balance target: a casual player must still win, in 300 to 1,200 moves, before the clock runs out, while a campaign that never builds must lose.
- **`tests/rendered-html.test.mjs`** covers the built pages and links, and checks that no page links to a real campaign site or uses a campaign slogan. It also checks the 51-row electoral table on the guide and the source citation, and runs custom-domain and staged builds.

## What to watch

| Signal | Where | Healthy |
|---|---|---|
| Open `ops-alert` issues | Issues tab; GitHub's failure emails | None open |
| Weekly self-test | Actions → Weekly self-test | Green every week |
| Starts, wins and shares, once analytics is on | GoatCounter events: `campaign_start`, `level_2` … `level_8`, `campaign_won` (activation), `campaign_lost`, `share_native` / `share_download` / `share_copy` | Wins per start, and shares per win (the swing factor) |
| Electoral votes | The table in `src/states.ts` (source: the National Archives) | Valid through the 2028 election. It changes only after the 2030 Census, for the 2032 election. |

## Run anything by hand

```bash
npm ci --ignore-scripts
npm test                                   # type check, unit tests, build, rendered-HTML tests
npm run e2e                                # scripted campaign of dist/ in headless Chrome
node scripts/e2e.mjs https://theguysaccount.github.io/pres2028-citizen-game/
node scripts/check-live.mjs https://theguysaccount.github.io/pres2028-citizen-game
npm run screens                            # docs/screens/*.png at desktop and phone widths
npm run map                                # regenerate src/generated/us-map.json from us-atlas
node scripts/og.mjs                        # re-render public/og.jpg
~/.local/bin/gh workflow run pages.yml -R theguysaccount/pres2028-citizen-game
```

## Keys Jack can turn later

None of these are needed for the game to work.

### 1. Custom domain (the base address is one setting: `SITE_URL`)

The "domain rollout" session sets domains up, and nothing here changes DNS. What exists on 2026-11-22:

- `pres2028.com`: live (SiteGround), with a different site. Per the build-on-top rule, this game would go on a subdomain such as `play.pres2028.com`.
- `ifwewerepresident.com`: a Namecheap parking page. The portfolio lists it for the "collective-presidency framing" of this game.
- `pres2032.com`, `president28.com`: live, with other sites.
- `pres2032.org`: redirects to pres2032.com.
- `presi2028.com`, `2028president.org`, `president2032.org`: parked.

**Read before choosing.** The game must stay fiction with no real candidate. If pres2028.com promotes a real person, committee or PAC, hosting the game on its subdomain could tie the game to that campaign. The prompt flags FEC in-kind and disclaimer rules for that case. A neutral name such as `ifwewerepresident.com` avoids the question. This is Jack's call.

Steps, in this order, so canonicals never point at an address that does not answer yet:

1. **DNS, in the zone that serves the domain.**
   - For pres2028.com that zone is SiteGround's (its nameservers are SiteGround's); for the parked names it is Namecheap's Advanced DNS.
   - For a subdomain, add `CNAME play → theguysaccount.github.io.`
   - For an apex instead, add:
     - `A @` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
     - `AAAA @` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
     - `CNAME www` → `theguysaccount.github.io.`

     Remove any parking records for that host first.
2. **Point Pages at the domain:** `~/.local/bin/gh api -X PUT repos/theguysaccount/pres2028-citizen-game/pages -f cname=play.pres2028.com`. You can also use Settings → Pages → Custom domain. The site deploys from a workflow, so no CNAME file is used.
3. **Turn on HTTPS** once the certificate shows as issued: `~/.local/bin/gh api -X PUT repos/theguysaccount/pres2028-citizen-game/pages -F https_enforced=true`
4. **Move the site's address:**
   1. `~/.local/bin/gh variable set SITE_URL -b https://play.pres2028.com -R theguysaccount/pres2028-citizen-game`
   2. `~/.local/bin/gh workflow run pages.yml -R theguysaccount/pres2028-citizen-game`

   Canonicals, sitemap, share card, challenge links, structured data, the health checks and IndexNow all follow `SITE_URL`.
5. **What happens next.**
   - The github.io address redirects to the domain by itself.
   - Saves belong to the browser's address, so players carry a campaign across with the SAVE button's save code.
   - Redirect domains can 301 to the new address with a Namecheap URL redirect.

### 2. Money: one support link

GitHub Pages is non-commercial, so the game sells nothing itself. The slot is a footer link, hidden until set. Use only a game support page, such as a pay-what-you-want itch.io page. **Never point it at a campaign, committee or donation page:** that would end the fiction and raise the campaign-finance questions in the prompt.

1. `~/.local/bin/gh variable set SUPPORT_URL -b https://<you>.itch.io/pres2028-citizen -R theguysaccount/pres2028-citizen-game`
2. Optional: `~/.local/bin/gh variable set SUPPORT_LABEL -b "PAY WHAT YOU WANT" -R …`
3. `gh workflow run pages.yml`. Only https links are accepted.

### 3. Analytics: the activation metric

Off by default. The game loads no analytics, and the About page says so. To turn it on, create a free GoatCounter site, then run `~/.local/bin/gh variable set GOATCOUNTER_URL -b https://<code>.goatcounter.com/count -R theguysaccount/pres2028-citizen-game` and redeploy. The events are already in the code, and automated browsers are never counted.

### 4. itch.io release (needs an account)

1. Build and zip the site: `SITE_URL=https://theguysaccount.github.io/pres2028-citizen-game npm run build && (cd dist && zip -r ../pres2028-itch.zip .)`.
2. Upload it as an HTML game, played in the browser, at a 1280×800 viewport with "Mobile friendly" on.
3. Tag it strategy, incremental, educational and political. Every path in the build is relative, so it runs inside itch's frame.

### 5. Search Console

After key 1, verify the domain in Google Search Console and submit `/sitemap.xml`. Bing and the other IndexNow engines are pinged on every deploy.

### 6. Cross-links

The machine loop names a cross-link from the live politicz.org. That site is another venture's repository, so it was not touched from here. If its owner wants it, add a link to this game's address in its footer. The sister games (Speed Run Heaven, Coagulation Corp) are listed in this game's About page through `site.json` → `moreGames`.

### 7. After 2028 (optional Claude routine)

The race is set in 2028, and the electoral table is valid through that election. In early 2029, a Claude Code routine could decide whether to re-theme the game for 2032. It would use the post-2030-Census apportionment, published by the National Archives in early 2031. Run it in a checkout of this repo with this prompt:

> Pull main. If the National Archives has published electoral votes for 2032, update `src/states.ts` (keep the source comment), rename the race in `src/engine.ts` (TIMELINE years, CAMPAIGN_DAYS if needed), regenerate the map with `npm run map`, run `npm test` and `npm run e2e`, then commit and push. Keep the game fictional: no real party, candidate or slogan. Do not post anywhere.

## Safety and privacy rules the code keeps

- **Fiction, stated everywhere.** The game is labelled fiction on the intro, in the always-visible strip, in the result dialog, on the share card, on the About and guide pages, and in the description.
  - No real party, candidate, committee, slogan or campaign link appears.
  - The mandates are invented planks, not pledges; the dated "by 2036" pledge wording was removed.
  - A test fails the build if a page links to pres2028.com, pres2032.com or similar, or uses "Save America" or donation language.
- **Consent.** The original "Meta glasses kit" is now the "Story Camera Kit". A door conversation becomes a story only "with a neighbor's OK".
- **Privacy.** There are no donation, sign-up, contact or voter-contact features. There are no cookies and no accounts, and saves stay in the browser. A challenge link carries one number: the winning campaign day.
