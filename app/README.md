# TABLE — the AI-native party app

> Text one sentence. Get a whole party.

An AI-native MVP where the agent **is** the interface: hosts describe a dinner in one
sentence, a crew of agents builds the page, sells the seats (address revealed only after
payment), backfills cancellations from the waitlist, and fires the **AfterParty Drop**
the morning after.

The consumer layer on top of that quiet engine:

- **The AI Cohost** — every party gets a character in its group chat: welcomes each paid
  guest, assigns who brings what, answers "what's the address again?" at 2am, drops a
  T-24h hype message, and hands out end-of-night superlatives. Hosts pick its vibe:
  chaotic bestie 😜, formal butler 🎩, or unhinged hype man 📣.
- **One Shot** — each guest gets exactly **one** photo for the whole night (enforced by a
  DB unique constraint, not an honor system). The roll stays sealed and "develops"
  overnight, revealing on the Drop page the next morning.
- **Invites that are little worlds** — every paid guest gets a personalized card
  ("🌙 The Last to Leave") and a bring-duty, assigned at payment.
- **The AfterParty Drop** (`/drop/[eventId]`) — the One Shot reveal, a Wrapped-style card
  ("your 7th night at Maya's"), mutual-tap connections, and feedback.
- **Taps** — tap someone from the night as 🫶 **Vibe** (friend), ⚡ **Collab**
  (build/work/run together), or 💘 **Crush**. Pure double-blind: nothing is ever revealed
  unless both people tap each other with the *same* intent. Taps unlock at the morning
  reveal alongside the One Shot roll and close 48 hours later — one ritual, one reason
  everyone opens the app the next morning. On a match, **the Cohost plays wingman**: it
  opens the pair's private chat with receipts from the night ("Leo was 🌙 The Last to
  Leave · his One Shot: 'the 18-hour broth moment'") so nobody sends a cold "hey".
- **Run it back** — one tap clones a completed event a week out; when the sequel is
  published, everyone from last time automatically gets first-access notifications.

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
| Host | `maya@table.demo` | Dashboard with a live dinner, a sold-out dinner with a waitlist, and a completed dinner with a developed One Shot roll + AfterParty Drop |
| Guest | `leo@table.demo` | Tickets, a waitlist spot, a party chat with the Cohost, a persona card, and a mutual connection |
| Anyone | any email | Fresh account, can book or host immediately |

**A 2-minute demo script**

1. Sign in as `maya@table.demo`, open **Crew** (chat), type:
   *"Host a six-course Oaxacan dinner Saturday, 10 seats, $85"* → the agent creates a draft.
2. Say *"publish and accept terms"* → live shareable event page.
3. Sign out, sign in as any new email, open the event from **Explore**, book a seat,
   "pay" on the mock checkout → the address unseals and the **party chat** opens — the
   Cohost welcomes you with your persona card and bring-duty. Ask it
   *"what's the address again?"*.
4. Sign in as `leo@table.demo` → open `/drop/…` from the inbox: the developed One Shot
   roll, your Wrapped card, and the Taps window (closes in ~42h). Tap Priya as 💘 Crush —
   she already tapped you, so it matches live and the Cohost opens your chat with
   receipts from the night. (Tap her as anything else and neither of you ever finds out.)
5. Back as Maya: **Hosting** → the completed "Backyard Ramen Night" → AfterParty summary,
   then hit **Run it back** on its Drop page to spawn the sequel with first access for
   past guests.
6. `curl localhost:3000/api/cron` — the scheduler tick that fires AfterParty Drops ~12h
   after each dinner, drops T-24h Cohost hype messages, and delivers scheduled reminders.

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
│   │   ├── events.ts       create/update/publish/list/run_it_back (Setup agent)
│   │   ├── tickets.ts      book/cancel/roster/waitlist/payments (Door agent)
│   │   ├── party.ts        party chat: get/post messages, set_cohost_vibe
│   │   ├── oneshot.ts      take_one_shot, get_photo_roll (sealed → developed)
│   │   ├── afterparty.ts   run_afterparty, submit_feedback, summary (AfterParty agent)
│   │   ├── social.ts       Taps: tap_connect (3 intents, double-blind, 48h window),
│   │   │                   match chats, get_my_connections, get_my_wrapped
│   │   ├── activity.ts     get_my_activity (the "last N dinners" log), discover_events
│   │   └── index.ts        the tool manifest — register new tools here
│   ├── chat.ts           registry → AI SDK adapter + system prompt (real agent)
│   └── mock.ts           deterministic offline agent (no API key needed)
├── cohost/               the AI Cohost: 3 personalities (vibes.ts) + reply engine —
│                         LLM in character when a key is set, canned heuristics offline
├── events/bus.ts         domain-event bus + append-only activity log
├── notifications/        ISOLATED module: rules (event→notification), delivery
│   │                     adapters (in_app today; push/SMS = new adapter later),
│   └── scheduler.ts      the cron tick (reminders, auto-AfterParty)
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
