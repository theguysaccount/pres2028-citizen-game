# Launch

**Live:** https://theguysaccount.github.io/pres2028-citizen-game/ (indexed; launched 2026-11-22).
**Production domain:** set by the domain rollout session. The exact records, the one setting (`SITE_URL`) and a campaign-law note on which domain to use are in [OPERATIONS.md](OPERATIONS.md), key 1.

## Already running (machine channels)

- **Search basics.** Sitemap, robots.txt, canonical URLs, `VideoGame`, `FAQPage` and breadcrumb structured data, and a 1200×630 share image rendered from the game's map.
- **IndexNow.** Pinged on every deploy. The account root's robots.txt lists this site's sitemap, rebuilt daily.
- **The guide.** It answers real searches ("electoral votes by state", "how many states to win 270", "electoral college game") from the game's real table. The numbers are recomputed on every build.
- **Share loop.** A result card drawn on the device, with native share, PNG download and copy link. The `?day=` challenge link shows the next player the day to beat.
- **Embed.** A snippet for teachers on the About page.
- **GitHub discoverability.** Repo description, topics and README.

## First 1,000 players: plan (drafts only; nothing below has been sent)

In machine-driven mode nobody posts as a person. These drafts are ready if Jack, or a channel's own account, chooses to use them. Keep every post nonpartisan and say it is fiction.

**Where:**
- r/incremental_games, on its feedback and self-promotion threads (check the current rules);
- itch.io, as an HTML game (OPERATIONS.md, key 4);
- teacher communities that share civics resources (r/socialstudies and similar);
- Hacker News "Show HN";
- r/WebGames.

**Search terms the guide targets:** "electoral college game", "electoral votes by state 2028", "how many states to win 270", "270 to win game", "campaign simulator browser".

### Drafts

**r/incremental_games:** "PRES2028: Citizen – a short incremental where you organize a party-less campaign to 270 real electoral votes (free, no account, mobile-friendly)"
> Each move costs campaign hours (door 3h, DM 1h, story 2h), and you have 730 days. Reach turns into belief, believers become organizers, and organizers win states with their real electoral votes. Upgrades compound, and so does the clock. A casual run takes 20–30 minutes. Your score is the day you clinch 270, so lower is better. There's a card and a "beat my day" link at the end. It's fiction: no party, no candidate. Feedback on pacing welcome.

**Teachers:** "A free browser game that teaches how 270 works"
> Students organize a fictional, party-less campaign. They win states that carry their real 2024–2028 electoral votes and discover why 270 takes 12 big states or 39 small ones plus DC. There are no accounts and no data collection, and it works on Chromebooks and phones. It can be embedded with the snippet on the About page.

**Show HN:** "Show HN: An electoral-college incremental game, static and balanced by scripted players"
> React prerendered to static HTML with an SVG map. Scripted players run on the real rules at every build. They enforce the balance target in tests and publish the campaign lengths in the guide.

### 14-day calendar (if a human runs it)

| Day | Action |
|---|---|
| 1 | itch.io page live (key 4), analytics on (key 3) |
| 2 | r/incremental_games feedback post |
| 3 | Read the replies and the `level_*` drop-off, then fix the worst stall |
| 4 | Teacher-community post with the guide link |
| 6 | Show HN |
| 8 | r/WebGames |
| 10 | Compare shares per win; if low, make the card more prominent |
| 12 | Second teacher post timed to a civics unit (electoral college lessons) |
| 14 | Review wins, share rate and best days; decide on the domain (key 1) |
