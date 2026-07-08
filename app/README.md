# plot — main character energy, as a service

> Every event is an episode. Every crew is a show. Your profile is the receipts.

An AI-native app where the agent **is** the interface: hosts describe a night in one
sentence, a crew of agents builds the page, sells the seats (address revealed only after
payment), runs the night, and fires **the Reveal** the morning after.

**BEFORE — anticipation:**

- **Themes re-render the night** — House Classic 🏠, Y2K Rooftop 📟, Murder at the Manor 🕯️,
  Monsoon Chai 🌧️, Finish Line 🏁. A theme swaps the palette, the One Shot film stock,
  the superlative categories, the icebreakers, the dress code, and a one-tap playlist.
- **Drop mechanics** — live countdown, "Maya and 5 others are going", and early access:
  when a show's sequel publishes, past guests get 6 hours before the link goes wide.
- **The mystery seat** 🎭 — one blind ticket per event at 20% off (host opt-in).
- **Duo tickets** 👯 — two seats at 10% off each; the +1 claims via a link and must be
  **new to plot** (structural growth loop).
- **Refundable deposits** 🤝 — free events can hold a deposit that's released the moment
  you check in at the door. Flaking dies.
- **Vibe check** — a 30-second one-tap quiz at booking that assigns teams and feeds the
  wingman ("you both picked 3am deep talks").
- **Personal referral links** — every booked guest gets one; roster shows who brought whom.
- **Run clubs as a vertical** — the `run_club` template adds waivers and bib numbers; the
  theme handles the rest.

**DURING — the night runs itself:**

- **The AI Cohost** — welcomes each paid guest, assigns bring-duties, answers "what's the
  address again?" at 2am. Vibes: chaotic bestie 😜, formal butler 🎩, hype man 📣.
- **Plot twists** 🌀 — set an intensity (chill/spicy/chaos) and the Cohost fires one
  mid-event surprise into the chat (scheduler-driven; hosts can also fire manually).
- **One Shot** — one photo per guest, rendered as a **film still at capture** (theme film
  stock, grain, letterbox/polaroid/VHS frame, title burned in). Sealed until morning.
- **Overheard** 🗣 — anonymously log the wild things people say; the best become
  typographic cards at the Reveal. Host moderation optional.
- **Superlative voting** 🗳 — secret ballots during the night (categories from the theme),
  winners crowned at the Reveal.
- **Lost & Found** 🧣 — snap what someone left behind, straight into the party chat.
- **The Tab** 💸 — "log $60 for pizza" → even split across attendees → payment requests
  with the memory attached.

**AFTER — the Reveal (`/drop/[eventId]`):**

- **The episode title card** — the Cohost names the night from what actually happened
  ("The 18-Hour Broth Incident"), LLM or offline.
- The One Shot roll **develops** (blur-to-sharp), Overheard cards, award winners, the Tab,
  a Wrapped card, and **story-still export** (9:16 share card).
- **Taps** — tap anyone from the night as 🫶 Vibe, ⚡ Collab, or 💘 Crush. Pure
  double-blind, same-intent matches only, 48h window. On a match the **Cohost plays
  wingman** with receipts from the night — including vibe-check overlap and (opt-in)
  automatic IG handle exchange.
- **Recap** (`/recap/[id]`) — story-format auto-advancing highlight reel.
- **Run it back** — clones the night a week out and files it under a **show**.

**IDENTITY — episodes & seasons:**

- **Shows** (`/show/[id]`) — recurring nights become series with an episode archive
  ("S1E4 · 'The Pineapple Incident'"). Hosts close seasons; the **Season Finale**
  (`/show/[id]/finale/[n]`) is an auto-generated trailer for the season the crew lived.
- **Your receipts** (`/me`) — episodes this year, characters met, superlative shelf, main
  cast, your shows. Proof of a life, not a feed. IG handle + share opt-in live here.

## Run it (zero config)

```bash
npm install
npm run setup     # creates the SQLite db + seeds demo data
npm run dev       # http://localhost:3000
```

That's it. No API keys required — payments use a built-in mock checkout and chat uses a
deterministic offline agent. Both upgrade to the real thing with env vars (see below).

**Demo accounts** (passwordless — the 6-digit code appears on the login screen in dev):

| Who | Email | What you'll see |
|---|---|---|
| Host | `maya@table.demo` | "Maya's Table" show (S1E1 completed, S1E2 live with mystery seat + duo tickets), theme picker, night mechanics, Overheard moderation |
| Guest | `leo@table.demo` | Tickets, a party chat with the Cohost, a persona card, a collab match with an IG exchange, and receipts on `/me` |
| Anyone | any email | Fresh account, can book or host immediately |

**A 3-minute demo script**

1. Sign in as `maya@table.demo`, open **Crew** (chat), type:
   *"Host a six-course Oaxacan dinner Saturday, 10 seats, $85"* → the agent creates a draft.
   Try *"set the theme to y2k"* and *"what's the playlist?"*.
2. Say *"publish and accept terms"* → live shareable event page with countdown + social proof.
3. Sign out, sign in as any new email, open the live episode from **Explore** — note the
   🎭 mystery seat and 👯 duo options, take the vibe check, book, "pay" on the mock
   checkout → the address unseals and the **party chat** opens.
4. Sign in as `leo@table.demo` → the Reveal (`/drop/…` from the inbox): the episode title
   card, the roll **developing**, Overheard cards, award winners, the Tab (log a cost,
   host can settle up), and the Taps window. Tap Priya as 💘 Crush — she already tapped
   you, so it matches live and the Cohost opens your chat with receipts.
   Hit **▶ Play the recap** for the story-format highlight reel.
5. Check `/me` — episodes, characters met, the superlative shelf, your shows. Open the
   show archive → as Maya, **wrap season 1** and watch the Season Finale trailer.
6. `curl localhost:3000/api/cron` — the scheduler tick: auto-Reveals ~12h after each
   night, T-24h hype messages, **mid-event plot twists**, and scheduled reminders.

## Environment (all optional)

Copy `.env.example` to `.env.local`:

| Var | Effect when set |
|---|---|
| `ANTHROPIC_API_KEY` | Chat becomes a real Claude agent with the full tool registry (offline heuristic agent otherwise) |
| `STRIPE_SECRET_KEY` | Bookings go through real Stripe Checkout, test mode (mock checkout page otherwise) |
| `NEXT_PUBLIC_BASE_URL` | Base URL for payment redirects in production |
| `DATABASE_PATH` | SQLite file location (default `./data/table.db`) |

## Architecture

```
src/
├── agent/
│   ├── types.ts          Tool definition primitives + ActorContext (the security boundary)
│   ├── registry.ts       runTool() — the single choke point for ALL actions
│   ├── tools/            ← every app capability lives here, one file per domain
│   │   ├── events.ts       create/update/publish/list/run_it_back (+ themes, shows,
│   │   │                   early-access publicAt) (Setup agent)
│   │   ├── tickets.ts      book (standard/mystery/duo, vibe check, waiver, referral,
│   │   │                   deposits), claim_duo_seat, check_in_guest, roster (Door agent)
│   │   ├── party.ts        party chat: get/post messages (+ Lost & Found images),
│   │   │                   set_cohost_vibe
│   │   ├── night.ts        vote_superlative + tally, trigger_plot_twist, get_host_playlist
│   │   ├── overheard.ts    submit/get/moderate anonymous quotes
│   │   ├── tab.ts          add_tab_item, get_tab (even split), request_tab_payments
│   │   ├── oneshot.ts      take_one_shot, get_photo_roll (sealed → developed)
│   │   ├── afterparty.ts   run_afterparty (+ title card, deposit forfeits), feedback
│   │   ├── social.ts       Taps: tap_connect (3 intents, double-blind, 48h window),
│   │   │                   match chats, get_my_connections, get_my_wrapped
│   │   ├── shows.ts        get_show, close_season, get_my_profile (receipts), set_profile
│   │   ├── activity.ts     get_my_activity (the "last N nights" log), discover_events
│   │   └── index.ts        the tool manifest — register new tools here
│   ├── chat.ts           registry → AI SDK adapter + system prompt (real agent)
│   └── mock.ts           deterministic offline agent (no API key needed)
├── themes/               the identity engine: 5 theme packs (palette, film stock,
│                         superlatives, icebreakers, twists, playlist) + the vibe check
├── cohost/               the AI Cohost: 3 personalities (vibes.ts), reply engine,
│                         wingman (vibe overlap + IG exchange), episode title cards —
│                         LLM in character when a key is set, canned heuristics offline
├── events/bus.ts         domain-event bus + append-only activity log
├── notifications/        ISOLATED module: rules (event→notification), delivery
│   │                     adapters (in_app today; push/SMS = new adapter later),
│   └── scheduler.ts      the cron tick (reminders, auto-Reveal, hype, plot twists)
├── payments/             PaymentProvider interface: mock + Stripe (Connect later)
├── db/schema.ts          Drizzle schema — SQLite now, Postgres-ready
├── lib/auth.ts           passwordless email-code sessions
├── app/                  Next.js App Router UI (mobile-first)
│   ├── actions.ts        server actions = thin bridge from UI to runTool()
│   └── api/chat, api/cron
└── components/           shell, event cards, generated cover art
```

### The core idea: the service layer IS the tool registry

Every capability is defined **once** as a typed tool — name, LLM-readable description,
Zod input schema, execute function:

```ts
export const bookSeat = defineTool({
  name: "book_seat",
  description: "Book a seat at a published event for the current user…",
  inputSchema: z.object({ eventId: z.string(), answers: z.record(z.string(), z.string()).optional() }),
  agentCallable: true,
  execute: async (ctx, input) => { /* the only implementation */ },
});
```

Three callers share it, so behavior can never drift:

1. **Human UI** — server actions call `runTool("book_seat", ctx, input)`; buttons are
   just tools with UI on top.
2. **Chat agent** — `toAgentTools(ctx)` hands the registry to the AI SDK; the schema and
   description double as the agent's documentation.
3. **System** — the cron tick calls tools with `SYSTEM_CONTEXT` (e.g. auto-firing the
   AfterParty).

Authorization lives *inside* each tool via `ActorContext`, so the agent can never do
anything the UI couldn't.

### Domain events → notifications (proactive surfaces)

Every mutating tool emits a domain event (`ticket.paid`, `afterparty.fired`, …) which is:

1. **Appended to `domain_events`** — the activity log that lets the agent answer
   "based on your last 3 dinners…" generically (`get_my_activity`), with zero bespoke
   queries per feature.
2. **Fanned out to subscribers** — today that's `notifications/rules.ts`, which turns
   events into notification records delivered by channel adapters. `in_app` is the only
   real adapter in v1; **push/SMS/WhatsApp are each one new adapter file later** — the
   triggers, rules, and records never change.

Time-based behavior (T-24h reminders, auto-AfterParty at T+12h) lives in one place:
`notifications/scheduler.ts`, driven by `GET /api/cron` (point Vercel Cron at it).

## How to add a feature end-to-end

Example: "mystery seat" (one blind ticket per dinner). Three files:

1. **Tool** — `src/agent/tools/mystery.ts`: define `claim_mystery_seat` with
   `defineTool` (schema + description + execute, emit a `ticket.mystery_claimed`
   domain event). Add one line to `tools/index.ts`.
   *The chat agent can now do it — no chat-layer changes.*
2. **UI** — a button/section on the event page calling
   `toolAction("claim_mystery_seat", { eventId })`.
3. **Schema** (only if needed) — a column/table in `db/schema.ts`, then `npm run db:push`.

Optional 4th touch: if the feature needs a notification, add a case in
`notifications/rules.ts`.

## Design system

Defined entirely as tokens in `src/app/globals.css` (`@theme`): cream `#FFF6EC`
background (never gray), ink `#241A32`, tangerine `#FF5C38` primary, raspberry
`#E5397F`, butter `#FFC94A`, mint `#2FBF9B` for money-good states, and grape `#6C4AB6`
reserved for agent surfaces. Type is **Fraunces** (display) + **Inter** (UI). Cards are
20px radius, buttons are pills, shadows are ink-tinted (never gray), motion is 180ms
ease-out with one signature moment: the address "unseals" after payment.

## Production path

- **DB**: swap the Drizzle driver to Postgres (Neon/Supabase) — schema is compatible.
- **Payments**: set `STRIPE_SECRET_KEY`; Stripe Connect = a third provider in
  `src/payments`.
- **Auth email**: replace the console log in `lib/auth.ts` `requestLoginCode` with Resend.
- **Cron**: point Vercel Cron at `/api/cron` (e.g. every 15 min).
- **Native wrapper later**: the tool registry, data layer, and notifications module are
  UI-agnostic; an Expo shell reuses them through the same API routes, and push
  notifications are one new channel adapter.
