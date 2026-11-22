# Decisions

1. **Name: PRES2028: Citizen.** The title, README, tests and production domain all said PRES2028; the handoff and save key said PRES2032. The game uses PRES2028 and keeps the save key `pres2032-citizen-save-v1`, as the prompt asked, so older saves load.
2. **Static GitHub Pages instead of a Cloudflare Worker.** The same React component is prerendered at build time and hydrated in the browser. The canvas map became SVG with paths precomputed from us-atlas, about 58 KB instead of d3 plus a 115 KB atlas, and it is visible to crawlers and link previews. Dropped: vinext, Next, Tailwind's compiler (its reset is inlined), the Worker, D1/Drizzle and the auth stub.
3. **Balance pass.** The original doubled all output at each of 8 campaign levels. Scripted players won in 80–190 moves, a few minutes. The base is now 1.2. Results:
   - a "casual" player (follows missions, buys the cheapest upgrade now and then) wins in about 550 moves, around day 210;
   - a "planner" wins in about 360 moves;
   - a player who never builds loses.

   A test keeps the casual win between 300 and 1,200 moves. The guide republishes the numbers on every build.
4. **Real electoral votes.** States carry their 2024–2028 electoral votes (National Archives), 538 in all with 270 to win. The original lit one state per 500 organizers and scaled votes as states ÷ 50 × 538. Organizers reach the smallest delegations first, and holding E votes takes 0.9 × E^1.75 organizers in all. So the first state lights about 50 moves in (the original stayed dark for minutes), and each state is harder than the last. Players learn the real map: it takes 39 states plus DC from the small end, or 12 from the big end.
5. **"Meta glasses kit" became "Story Camera Kit"**, with consent in every line of copy ("with a neighbor's OK"). The mechanic is unchanged. The upgrade id `receipts` is kept for save compatibility.
6. **Mandates are labelled fictional.** "Dignified shelter by 2036" became "Dignified shelter for everyone". A dated promise reads like a campaign pledge.
7. **Fiction everywhere, and no link to any real campaign site.** pres2028.com, pres2032.com and president28.com serve live initiative and leadership sites, and the original README linked to pres2032.com. The game links to none of them, and a test fails the build if one appears. The original og.png ("PRES2032", "Save America", the name of a real PAC) is not published; a neutral image was rendered from the game's map.
8. **Indexed.** The game is not served anywhere else, so nothing duplicates it. The domain rollout session can put it on a subdomain (`play.pres2028.com`) or a neutral name (`ifwewerepresident.com`). OPERATIONS.md key 1 flags the campaign-law point that makes this Jack's call.
9. **Result card and `?day=` links, not a leaderboard.** The score is the campaign day of the win, where lower is better. This needs no server, no accounts and no personal data.
10. **Kept from the original:** no timers. Campaign time moves only when the player acts, and a test asserts it.
11. **Analytics off by default.** A cookieless GoatCounter switch is wired with the activation events.

## Open questions for Jack (defaults chosen; nothing blocks)

- **Canonical name and domain?** Default: PRES2028 on github.io. For a domain, see key 1 and its campaign-law note.
- **Does the game promote a person or the Pres2028 initiative?** Default: no. It is fiction with no real candidate and no links.
- **Awareness or recruitment?** Default: awareness only, with no email or volunteer capture.
- **Should the mandates mirror a real platform?** Default: no. They stay fictional.
