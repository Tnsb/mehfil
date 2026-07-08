# plot — the AI-native social events app
*Master product thesis v2 · YC Fall 2026 · 3 founders (CMU): AI/ML + LangGraph · ex-Salesforce director (NY) · developer who ran a restaurant in India*

**Tagline: doing it for the plot.**
**One-liner: text one sentence, get a whole party — with an AI cohost, one cinematic shot each, and a morning-after everyone opens.**

---

# 1. THE THESIS

Partiful made invites cute and won Gen Z. But Partiful is a *page* — a form with good design. plot is the *party*: an AI-native app where the event runs itself, the night produces its own content, and the experience keeps going the morning after. Gen Z is lonelier than any generation (nearly a quarter of 18–29-year-olds report loneliness, yet 79% plan to attend more events in 2026), run clubs are being called the new dating apps, supper clubs sell out in hours — IRL is the product of the decade, and the tooling for it is a form builder from 2020 with zero AI.

**The organizing idea: every event is an episode.** Your life with your people is a show, and plot is where it airs. Every one of its artifacts — the still, the recap, Overheard cards, the season finale — is a growth surface. Partiful grows once per event (the invite). plot grows twice (the invite AND the morning-after Reveal).

**The moat, in order:** (1) AI-native flow a form-based app cannot retrofit without a rebuild, (2) the earned social graph — edges only from people who actually shared a night, (3) the archive — a crew's seasons of lore live here and can't be exported, (4) the quiet money/ops engine underneath (take rate, deposits, splits, waivers) that a cute-invites company will never prioritize.

---

# 2. EPISODES & SEASONS — the frame that makes everything click

This is the identity of the product. It works for ANY event type because it maps to how people already narrate their lives ("that was an episode," "new character unlocked," "character development").

- **Every event = an episode.** The morning after, the Cohost auto-writes the title card from what actually happened: *"Ep 7: The Pineapple Incident."* The title card headlines the Reveal, the recap, and the archive.
- **Recurring anything = a series with seasons.** A game-night crew, a run club's training block, a supper club's menu run, a startup event series' quarter, a kitty circle's year — seasons close automatically at natural boundaries (semester, season, 10 episodes) or when the host calls it.
- **One-offs = specials.** A birthday, a housewarming, a launch party — a standalone special under the host's show. Big life events (a wedding, a graduation) render as *feature-length specials* with their own poster.
- **Every person has their own show.** Your profile is your seasons: every episode you appeared in, across every crew. People you meet are **characters** — recurring friends are *main cast*, someone new is a *new character this season*. ("2027, Season so far: 23 episodes · 14 new characters · main cast of 6.")
- **The archive = Insta-highlights, done natively.** A show's page is a row of episode bubbles — title card, the roll, superlatives, Overheard cards. Tap through a season like highlights. This is the lore page, upgraded.
- **The Season Finale = Wrapped, done better.** At season close, the AfterParty agent cuts a *trailer-style* recap from every episode's roll — movie-trailer pacing, title cards, the season's best Overheard quote. Crew-level finales AND a personal finale (your year as a show). Screenshot-and-share bait with an emotional core Spotify Wrapped doesn't have: these are your actual people.

Why it works for any vertical: a supper club is a cooking show (the chef is the showrunner, menus are episodes). A run club is a sports doc (training arcs are literally seasons). A tech event series is a talk show (each demo night an episode, collab-taps build the cast). A kitty circle is a long-running family drama. A one-off rager is a special. Nothing about the frame assumes food, fitness, or format.

---

# 3. PRODUCT PRINCIPLES (build laws)

1. **No forms, ever.** Everything starts as a sentence — creation, edits, questions.
2. **Web-first, zero-friction** (the Partiful playbook): RSVP from a link, no download, no account wall. The app earns its install through One Shot + the Reveal. PWA with camera access covers most of it.
3. **Fun in front, engine in the back.** Payments, deposits, waivers exist but never lead.
4. **Two viral moments per event.** The invite (before) and the Reveal (after). Every feature feeds one.
5. **Config, not code.** One generic event object; every vertical is a template + theme, not a codebase.
6. **The episode is the atom; the show is the molecule.** Recurring crews are first-class objects.
7. **Double-blind by default.** Taps never create one-sided anxiety.
8. **Everything generated is platform-native.** Feed 4:5, story 9:16, reel script + vertical cut, WhatsApp broadcast + status image — never one poster resized.
9. **Zero-effort magic.** No feature may depend on guests doing homework (the playlist lesson). If it needs guest effort, it must take one tap or be fun in itself.

---

# 4. THE AGENT CREW

| Agent | Job |
|---|---|
| **Cohost** ⭐ | The hero. Lives in the event chat: hypes the countdown, assigns who-brings-what, answers "what's the address" at 2am, runs icebreakers and superlative votes, writes the episode title, plays wingman on taps. Hosts pick its vibe (chaotic bestie, formal butler, unhinged hype man). |
| **Setup** | One sentence → event page, theme, guest cap, date logic, price if paid. Conversational edits. |
| **Hype** | Platform-native promo: feed poster, story countdown, reel script + auto-cut vertical, WhatsApp broadcast + status image. Drop mechanics (countdown, waitlist blasts, "3 spots left"). |
| **Door** | RSVPs, plus-ones, waitlist auto-backfill, reminders, refundable deposits to kill flaking, address-release rules, waivers for physical events, ticket payments + chasing. |
| **AfterParty** ⭐ | The morning after, automatically: develops the roll, writes the title card, cuts the recap, publishes superlatives and Overheard cards, opens the taps window, runs the Tab, offers one-tap "run it back," closes the episode into the archive. |

---

# 5. FEATURES — THE FULL DECK

## BEFORE (hype)

- **Sentence-to-party** from web, iMessage, or WhatsApp.
- **Living invites** — each guest gets a personalized version: their name in the artwork, their murder-mystery role, their bib number. People compare invites → people share invites.
- **Drop mechanics** — sneaker-style releases: countdown page, waitlist SMS, past-guest early access, "3 seats left — Aditya and 2 others going."
- **Mystery seat** — one blind ticket per event.
- **Duo tickets** — two spots, small discount, your +1 must be new to plot.
- **Vibe check** — 30-second quiz at RSVP → seating/teams + tap-matching signal. One tap per question, fun in itself.
- **Group chat auto-spawn** with the Cohost inside; address drops per Door rules.
- **Hype texts** day-before; **countdown lock-screen widgets**.

## DURING (the night)

- **One Shot** ⭐ — every guest gets exactly ONE capture for the whole night. No retakes, no gallery uploads, shot through the app camera. It is not a photo — it's a **film still from the episode**: cinematic letterbox, the theme's film-stock grain, episode title and timestamp burned into the frame like a movie frame. **Live stills** capture 1.5 seconds of motion + a whisper of audio, so the roll feels alive. Your still goes to the shared roll, not your camera roll.
- **Overheard** ⭐ — anyone anonymously submits quotes from the night ("someone just said…"). The best become *"Overheard at Maya's Birthday"* typographic cards at the Reveal — anonymized, hilarious, and possibly more shareable than the recap itself. Works everywhere: dinner tables, mile 4 of a run, demo-night hallways.
- **Lost & Found** — one-tap "whose jacket is this" photo post in the event chat. Tiny feature, universal utility.
- **Superlatives** — voted during, revealed after (best dressed, MVP of the night, most likely to fall asleep first).
- **Plot Twists** — the Cohost injects one optional mid-event surprise: a flash vote, a prompt, a 10-minute game. Host pre-picks intensity (chill → chaos).
- **Check-in = deposit release** — tap in at the door; your hold refunds; your One Shot unlocks.

## AFTER (the Reveal — plot's second act)

- **The Reveal** — the roll "develops" overnight: stills fade in from blank frames (shake-to-develop for the impatient) and unlock for everyone at the same minute the next morning. The synchronized drop means a whole party's stills can flood stories simultaneously — ten people posting the same branded aesthetic at 10am IS the marketing.
- **The Recap** — auto-cut vertical video: title card → stills → superlatives → best Overheard quote. Built to post.
- **The Tab** ⭐ — anyone logs costs ("pizza 60, decorations 25"); the Cohost splits across checked-in guests and sends payment requests (Venmo/Stripe links). Kills the awkward "hey can you venmo me" text forever. Supper clubs: wine/add-on splits on top of tickets. Run clubs: brunch split.
- **Taps** ⭐ — the connection layer, better than Partiful's Crush four ways: (1) **three intents** — vibe (friend), collab (work/project), crush — socially safe, covers run clubs and tech events, not just romance; (2) **pure double-blind** — nobody knows unless mutual, which is why it works at an 8-person dinner where Crush structurally breaks (they hide the shared event when it's "too obvious"); (3) **tied to the night** — only people from that episode, window opens at the Reveal, closes 48h later (ritual + urgency); (4) **the Cohost is the wingman** — matches open with context ("you were both team green at trivia"), and can **auto-exchange Instagram handles on match** (opt-in) — because "what's their @" is the actual morning-after behavior.
- **Story-ready stills** — every still exports pre-formatted for IG stories with the episode title; the plot watermark rides every post.
- **Run it back** — one-tap rebooking / next-date pre-sale, past guests first.
- **Referral links** per guest; hosts see who fills their room.

## THE ARCHIVE (why people stay)

- **Shows & seasons** (section 2) — episode bubbles, title cards, rolls, superlatives, Overheard cards. A crew's collective memory; leaving plot means abandoning your seasons.
- **Profiles are receipts, not claims** — "Season 2027: 23 episodes · 14 new characters · main cast of 6 · superlative shelf: Best Dressed ×3." Partiful profiles say *I go out*; plot profiles are evidence.
- **Season Finales** — trailer-cut recaps per show + your personal year-as-a-show finale. The Wrapped moment, with people instead of songs.
- **Regulars** — attend 3 of a host's episodes → main-cast badge, early access, a saved seat.
- **Printed rolls (premium)** — mail the host the episode's stills as physical prints. Tangible beats digital; gorgeous gift; margin.

---

# 6. THEMES — the identity engine

Themes re-render the event, not re-skin it:

- **One prompt** ("Y2K rooftop," "monsoon chai evening," "murder at the manor," "F1 watch party") → invite art, page design, dress-code moodboard, poster style, superlative categories, icebreakers, and — crucially — the **One Shot film stock** (grainy disposable / VHS / sepia / Polaroid-style frame) so the whole roll shares one aesthetic.
- **Seasonal official drops** — Halloween, Diwali, Galentine's, NYE packs; limited-time = urgency + screenshot moments.
- **Community theme packs** — creators publish packs; featured ones get surfaced; later a marketplace with tiny rev share.
- **Vertical presets** — run club: bib invites, route card, finish-line film stock. Game night: scoreboard, bracket. Supper club: menu-card invites (we never generate menus — we amplify the chef's). Tech event: name-tag invites, collab-tap default, demo-slot scheduler. Kitty party: tambola cards, WhatsApp-native formats, Hindi/Hinglish.

---

# 7. MUSIC — zero-effort only (the playlist lesson: nobody has time to queue songs)

Music stays, but only where no guest lifts a finger:

- **Host playlist, one tap** — theme → a ready playlist exported to the host's Spotify/Apple Music. Host value, zero guest homework.
- **Recap cut to trending audio** — the AfterParty agent scores recaps to currently-trending IG/TikTok sounds (trend-aware selection), because trend-audio recaps travel further than any static.
- **Season finales scored like trailers** — rising music, title cards, the drop on the season's best still.
- **The plot sting** — a signature two-second sonic logo on every Reveal and recap (Netflix ta-dum energy). Sonic branding is free and compounds: when the sting plays on someone's story, people know a plot dropped.

---

# 8. WHO IT'S FOR — one engine, many rooms

| Segment | What plot gives them | Frame |
|---|---|---|
| **House parties / birthdays** (Partiful's turf — enter second) | Cohost + One Shot + Reveal make the party better, not just organized; the Tab kills money awkwardness | Specials |
| **Game nights & trivia crews** | Deposits fix two-flakes-ruin-the-table; brackets; the archive compounds weekly | The longest-running shows on the app |
| **Run clubs** (59% club growth 2024; new clubs tripled 2025; "the new dating apps") | Waivers, roster, deposits vs no-shows, finish-line stills, sponsor-ready recap (attendance, repeat rate, reel) = the pro-tier reason | Training arcs = seasons |
| **Supper clubs & apartment cafes** (paid) | Full engine + ticketing take rate + quiet compliance info (LA MEHKO) + insurance embed + wine splits via the Tab | The chef's cooking show; menus are episodes |
| **Startup / tech events** (Luma's turf, Meetup's refugees) | Deposits fix free-event no-shows; collab-taps + handle exchange = networking that actually works; Overheard is scary-good in hallways | A talk show; each demo night an episode |
| **Karaoke nights** | Performance superlatives, the roll, Overheard gold | Variety show |
| **Kitty parties (India, later)** | WhatsApp-first, tambola in-app, themed months, the memory layer no tracker app has. Never custody the pool (chit-fund rules) — ledger + UPI links only | A long-running family drama |
| **Corporate socials (much later)** | Collab-taps, recap for teams | Batch+2 |

---

# 9. VS PARTIFUL — the battle plan

- **They are a page; we are the party.** Zero AI features confirmed on their side; retrofitting conversation-first + Cohost onto a form product is a rebuild. Speed is the game.
- **Their profiles are claims; ours are receipts.** Mutuals = same 150-person party. plot edges = shared a table and both tapped. Density beats breadth.
- **Their Crush breaks at small events** (they hide the shared event when "too obvious"); Taps are built for small events — where all our verticals live.
- **They grow once per event; we grow twice.** Invite + Reveal (+ the synchronized still drop).
- **We own recurring social first** — game nights, run clubs, supper clubs — where habit forms, seasons compound, and they have no streaks, deposits, or rebooking. Win scenes (a campus, a neighborhood run circuit), then take the birthday parties.
- **They can't follow the money down.** Payouts, deposits, splits, waivers, tax summaries, insurance — unglamorous infrastructure a cute-invites company deprioritizes forever. Hosts graduate to plot.

---

# 10. GROWTH LOOPS

1. **Invite loop** — every guest touches plot to RSVP (no download) → sees a living invite → "what app is this?"
2. **Reveal loop** — everyone returns the morning after (synchronized) → story-ready stills + Overheard cards + recap flood socials → non-followers see them.
3. **Referral loop** — duo tickets + personal referral links.
4. **Show loop** — one member hosts on plot → the crew's seasons start accumulating → the next host in the crew defaults to plot.
5. **Finale loop** — season finales and personal year-shows are the Wrapped moment: mass simultaneous sharing at semester/year end.

---

# 11. QUIET ENGINE (in the product, never the pitch)

Stripe Connect when hosts charge (take rate in legal markets) · refundable deposits · the Tab (splits via Venmo/Stripe links — we facilitate requests, we don't custody group funds) · waiver capture · address-after-RSVP/payment · one-day event insurance embed (Thimble API — carrier bears risk, we take commission) · static compliance info pages (LA MEHKO routes; information, never legal verdicts) · host earnings summaries at year-end · ToS: hosts warrant legality and indemnify · India: never custody kitty pools — ledger + UPI links only.

# 12. BUSINESS MODEL

Free for free events (forever — the growth engine) → **take rate** on paid tickets (a few %, vs EatWith ~30%, Posh ~10%) → **pro tier $29–59/mo** for recurring organizers (sponsor recaps, rosters, deposits, advanced themes) → printed rolls + theme marketplace + insurance commission as kickers → guest-side membership optionality if the graph gets dense.

# 13. BUILD PLAN (for Claude Code / Cursor)

**Stack:** Next.js PWA (web-first; camera via web APIs) · LangGraph + Claude for the agent crew · Stripe Connect · Twilio SMS + WhatsApp Business API (start A2P 10DLC registration day one) · Postgres · image-gen for invites/posters/title cards + film-stock processing pipeline · ffmpeg for live stills + recap/finale cuts.

**Data model core:** `Show` (crew or host series; seasons) · `Event` (episode: title_card, vibe, theme, datetime, capacity, price?, reveal_at, template_id, show_id?) · `Guest` ↔ `RSVP` (vibe-check, deposit state, check-in) · `Shot` (one per guest per episode; media, film_stock, develops_at) · `OverheardQuote` (anon, event_id, featured?) · `TabItem` + `Split` · `Tap` (from, to, intent, event_id; double-blind resolution) · `Edge` (mutual → graph, handle_exchange?) · `Superlative` · `ThemePack` · `Message` (Cohost chat).

**Phase 0 — now → Jul 22 (apply early):** sentence-to-party + living event page + no-download RSVP + Cohost v1 in chat + One Shot (film-still render + overnight develop) + the Reveal + episode title cards + Overheard + recap v1 + Taps v1. Run 3–5 real events ourselves (a game night, a dinner, a run). App metrics: events created, guests touched, Reveal-open rate, still/recap shares.
**Phase 1 — Aug (interview season):** ship weekly. The Tab, deposits, drop mechanics, Themes v1 (3 packs + film stocks), live stills, second vertical live as pure config (run club), story-export polish + the sting. Show week-over-week actives.
**Phase 2 — batch:** density in one scene (campus or neighborhood) → seasons + finales at scale → paid-tickets layer in LA (MEHKO hosts) → pro tier → printed rolls.

**North-star metric:** weekly episodes per active show. Supporting: Reveal-open rate (>70% of attendees), taps per episode, still/recap share rate, K-factor (invite + Reveal loops), WoW WAU growth.

# 14. RISKS

Partiful ships AI (defense: paradigm not feature; speed; season lock-in) · consumer social is a hits business (defense: recurring-show wedge = retention floor; quiet revenue engine = business floor) · the Reveal must feel magical or One Shot flops (obsess over the develop moment; test at real parties week one) · Overheard needs moderation guardrails (host approval toggle, report flow, no names attached) · SMS approval lag (WhatsApp + email fallback) · paid-events legal exposure (legal-market gating, ToS, never custody pools) · founder commitment answers aligned and honest for YC.

# 15. THE STORY IN ONE BREATH

Partiful made the invite cute. plot makes the night a show — an AI cohost runs it, everyone gets one cinematic shot, the roll develops at sunrise, the best line of the night becomes a card, your crush might tap back, and your crew's season grows one episode at a time. Doing it for the plot.
