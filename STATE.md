# State (rebuild of 2026-11-22)

**Original.** The iCloud folder `New project/pres2032-game` (last touched 2026-07-16) and `PRES2032-DEVELOPER-HANDOFF.md`. It is a Next.js 16 / vinext app built for a Cloudflare Worker. It was never deployed, and it has no analytics and no traction. Its build and tests ran.

**What worked and was kept.** The whole game in `app/CitizenGame.tsx`:
- the reach → belief → organizer loop and the three outreach moves;
- 7 field upgrades (cost ×1.58, rate ×1.42), 8 mandates, the 8-stage timeline and missions 01–05;
- the 730-day clock, and the pause while away;
- the retro pixel stylesheet with mobile tabs;
- the save key `pres2032-citizen-save-v1`, so old saves still load.

**What was broken or risky, and is fixed:**
- **Balance.** Scripted players won in 80–190 moves (a few minutes), because campaign levels doubled output each time. The scale base is now 1.2. A casual win takes about 550 moves, roughly 20–35 minutes.
- **The map.** It counted 500 organizers per state and invented electoral votes (states / 50 × 538). States now carry their real 2024–2028 electoral votes, with a rising organizer curve.
- **A trademark.** "Meta glasses kit" used Meta's name, and its "auto-recorded doors" implied recording people. It is now the "Story Camera Kit", framed around consent.
- **Pledge-like text.** "Dignified shelter by 2036" read like a pledge; the date is gone. Mandates are labelled fictional.
- **Branding and image.** The brand flip-flopped between PRES2032 and PRES2028. The unused og.png says "PRES2032" and "Save America", which is the name of a real political PAC. It is not shipped; a new share image was rendered from the game's map.
- **Missing pieces.** There was no fiction label beyond the intro, no result card, no OG image and no SEO.

**Not carried over.** The Worker, ChatGPT auth, the D1/Drizzle scaffold, `.openai/hosting.json`, the README link to pres2032.com, and the obsolete `CitizenGame 2.tsx` (absent from the copy).

**Now.** A static GitHub Pages site with React prerendered at build time and an SVG map. Tests: 18 unit tests, 11 page tests, a 44-check scripted campaign, and weekly live checks.
