/**
 * TABLE data model.
 *
 * Design notes:
 * - `events` is the generic event object from the scoping doc: vertical-specific
 *   behavior lives in `template` + `templateConfig`, not in new columns.
 * - `locationAddress` is reveal-gated (only shown to paid guests); `locationHint`
 *   is the public teaser ("Silver Lake, exact address after booking").
 * - `domainEvents` is the append-only activity log. It powers the notifications
 *   pipeline AND generic agent queries like "based on my last 3 dinners…".
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date());

/* ---------------- users & auth ---------------- */

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  /** Instagram handle — used by the wingman's auto-exchange on tap matches */
  igHandle: text("ig_handle"),
  /** opt-in: share my IG handle automatically when a Tap matches */
  shareHandleOnMatch: integer("share_handle_on_match", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: createdAt(),
});

export const authCodes = sqliteTable("auth_codes", {
  id: id(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

/* ---------------- shows (crews & series — "every event is an episode") --- */

export const shows = sqliteTable(
  "shows",
  {
    id: id(),
    hostId: text("host_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    emoji: text("emoji").notNull().default("🎬"),
    /** seasons close at natural boundaries or when the host calls it */
    currentSeason: integer("current_season").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("shows_host_idx").on(t.hostId)],
);

/* ---------------- events (the generic event object) ---------------- */

export type EventQuestion = { key: string; label: string };
export type EventStatus =
  | "draft"
  | "published"
  | "sold_out"
  | "completed"
  | "cancelled";
export type CohostVibe = "chaotic_bestie" | "formal_butler" | "hype_man";
export type TwistIntensity = "off" | "chill" | "spicy" | "chaos";

export const events = sqliteTable(
  "events",
  {
    id: id(),
    hostId: text("host_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    /** short vibe line, e.g. "six courses, natural wine, strangers welcome" */
    vibe: text("vibe"),
    description: text("description"),
    /** vertical template: "dinner" today; "run_club", "listening_party"… later */
    template: text("template").notNull().default("dinner"),
    templateConfig: text("template_config", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    priceCents: integer("price_cents").notNull().default(0),
    capacity: integer("capacity").notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").$type<EventStatus>().notNull().default("draft"),
    /** public teaser shown before payment */
    locationHint: text("location_hint"),
    /** the real address — revealed only after payment */
    locationAddress: text("location_address"),
    /** checkout questions (dietary etc.) */
    questions: text("questions", { mode: "json" })
      .$type<EventQuestion[]>()
      .default([]),
    /** host warranty: accepted at publish time (compliance: route, never own) */
    tosAcceptedAt: integer("tos_accepted_at", { mode: "timestamp_ms" }),
    /** the AI Cohost's personality in the party chat */
    cohostVibe: text("cohost_vibe").$type<CohostVibe>().notNull().default("chaotic_bestie"),
    /** set when this event was created via "run it back" from a past event */
    parentEventId: text("parent_event_id"),
    /** when the AfterParty fired — anchors the 48h Taps window */
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    /* -------- episodes & seasons -------- */
    /** the show this episode belongs to (null = a one-off "special") */
    showId: text("show_id"),
    season: integer("season"),
    episodeNumber: integer("episode_number"),
    /** the Cohost-written episode title, e.g. "The Pineapple Incident" — set at the Reveal */
    titleCard: text("title_card"),
    /* -------- theme + night mechanics -------- */
    /** theme pack key (see src/themes) — drives palette, film stock, superlatives, icebreakers */
    theme: text("theme").notNull().default("classic"),
    /** the Cohost injects one mid-event surprise at this intensity */
    twistIntensity: text("twist_intensity").$type<TwistIntensity>().notNull().default("off"),
    /** refundable hold that kills flaking — released at check-in (0 = none) */
    depositCents: integer("deposit_cents").notNull().default(0),
    /** one blind discounted seat, host opt-in */
    mysterySeat: integer("mystery_seat", { mode: "boolean" }).notNull().default(false),
    /** duo tickets: two seats, small discount, +1 must be new to plot */
    duoTickets: integer("duo_tickets", { mode: "boolean" }).notNull().default(false),
    /** host toggle: Overheard quotes need approval before featuring */
    moderateOverheard: integer("moderate_overheard", { mode: "boolean" }).notNull().default(false),
    /** drop mechanics: before this instant only past guests of the show can book */
    publicAt: integer("public_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("events_host_idx").on(t.hostId), index("events_status_idx").on(t.status)],
);

/* ---------------- tickets ---------------- */

export type TicketStatus = "pending" | "paid" | "waitlisted" | "cancelled";
export type TicketKind = "standard" | "mystery" | "duo_lead" | "duo_guest";
export type DepositStatus = "held" | "released" | "forfeited";

/** personalized invite persona ("their tarot card") assigned at booking */
export type TicketPersona = { card: string; emoji: string; line: string };

export const tickets = sqliteTable(
  "tickets",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").$type<TicketStatus>().notNull().default("pending"),
    /** answers to the event's checkout questions, keyed by question key */
    answers: text("answers", { mode: "json" })
      .$type<Record<string, string>>()
      .default({}),
    /** the guest's personalized invite persona */
    persona: text("persona", { mode: "json" }).$type<TicketPersona>(),
    /** what the Cohost assigned this guest to bring */
    bringItem: text("bring_item"),
    /** standard / mystery (blind, discounted) / duo_lead / duo_guest */
    kind: text("kind").$type<TicketKind>().notNull().default("standard"),
    /** duo_guest only: share code the +1 claims with (null once claimed) */
    claimCode: text("claim_code"),
    /** vibe check: one-tap quiz answers keyed by question id */
    vibeAnswers: text("vibe_answers", { mode: "json" }).$type<Record<string, string>>(),
    /** team derived from the vibe check (seating/games signal) */
    team: text("team"),
    /** deposit lifecycle (only when event.depositCents > 0) */
    depositStatus: text("deposit_status").$type<DepositStatus>(),
    /** door check-in: releases the deposit, unlocks the One Shot */
    checkedInAt: integer("checked_in_at", { mode: "timestamp_ms" }),
    /** waiver acceptance (physical events, e.g. run clubs) */
    waiverAcceptedAt: integer("waiver_accepted_at", { mode: "timestamp_ms" }),
    /** bib number for run-club episodes */
    bibNumber: integer("bib_number"),
    /** who referred this guest (their personal link) */
    referredBy: text("referred_by"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("tickets_event_idx").on(t.eventId), index("tickets_user_idx").on(t.userId)],
);

/* ---------------- feedback (AfterParty) ---------------- */

export const feedback = sqliteTable(
  "feedback",
  {
    id: id(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id)
      .unique(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: createdAt(),
  },
  (t) => [index("feedback_event_idx").on(t.eventId)],
);

/* ---------------- party chat (the Cohost lives here) ---------------- */

export type MessageKind = "chat" | "cohost" | "system";

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    /**
     * null = the event's party chat; "match:<userA>:<userB>" (sorted ids) =
     * the private chat the Cohost opens for a mutual Tap.
     */
    thread: text("thread"),
    /** null = the AI Cohost */
    userId: text("user_id"),
    kind: text("kind").$type<MessageKind>().notNull().default("chat"),
    body: text("body").notNull(),
    /** optional attached image (Lost & Found posts) */
    imageDataUrl: text("image_data_url"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_event_idx").on(t.eventId, t.thread)],
);

/* ---------------- Overheard (anonymous quotes → typographic cards) -------- */

export type OverheardStatus = "pending" | "featured" | "hidden";

export const overheard = sqliteTable(
  "overheard",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    /** kept for moderation/abuse only — NEVER displayed */
    submitterId: text("submitter_id").notNull(),
    quote: text("quote").notNull(),
    status: text("status").$type<OverheardStatus>().notNull().default("featured"),
    createdAt: createdAt(),
  },
  (t) => [index("overheard_event_idx").on(t.eventId)],
);

/* ---------------- The Tab (costs → splits → payment requests) ------------- */

export const tabItems = sqliteTable(
  "tab_items",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    /** who paid for it */
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    label: text("label").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("tab_items_event_idx").on(t.eventId)],
);

/* ---------------- superlative votes (voted during, revealed after) -------- */

export const superlativeVotes = sqliteTable(
  "superlative_votes",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    voterId: text("voter_id")
      .notNull()
      .references(() => users.id),
    category: text("category").notNull(),
    votedForUserId: text("voted_for_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("superlative_votes_event_idx").on(t.eventId)],
);

/* ---------------- One Shot (one photo per guest, sealed until morning) ---- */

export const photos = sqliteTable(
  "photos",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    /**
     * unique → structurally enforces "exactly one shot per guest".
     * No FK: hosts shoot against a synthetic `host_<eventId>` id.
     */
    ticketId: text("ticket_id").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    /** data URL (base64 jpeg, client-downscaled) — swap for blob storage in prod */
    dataUrl: text("data_url").notNull(),
    caption: text("caption"),
    createdAt: createdAt(),
  },
  (t) => [index("photos_event_idx").on(t.eventId)],
);

/* ---------------- Taps (the earned graph, double-blind) ---------------- */

/**
 * Three intents, one mechanic: friend-vibes, work-collab, or crush.
 * A tap only becomes visible if the other person taps back with the SAME
 * intent — nobody ever learns about a one-way tap or a mismatched intent.
 */
export type TapIntent = "vibe" | "collab" | "crush";

export const connections = sqliteTable(
  "connections",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => users.id),
    intent: text("intent").$type<TapIntent>().notNull().default("vibe"),
    createdAt: createdAt(),
  },
  (t) => [
    index("connections_from_idx").on(t.fromUserId),
    index("connections_to_idx").on(t.toUserId),
  ],
);

/* ---------------- domain events (append-only activity log) ---------------- */

export const domainEvents = sqliteTable(
  "domain_events",
  {
    id: id(),
    /** e.g. "ticket.paid", "event.published", "afterparty.fired" */
    type: text("type").notNull(),
    /** who caused it (null for system) */
    actorId: text("actor_id"),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("domain_events_actor_idx").on(t.actorId),
    index("domain_events_subject_idx").on(t.subjectType, t.subjectId),
  ],
);

/* ---------------- notifications ---------------- */

export type NotificationStatus = "queued" | "sent" | "failed";

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    /** delivery channel; "in_app" today, "push"/"sms"/"whatsapp" later */
    channel: text("channel").notNull().default("in_app"),
    templateKey: text("template_key").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    status: text("status").$type<NotificationStatus>().notNull().default("queued"),
    scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Show = typeof shows.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Overheard = typeof overheard.$inferSelect;
export type TabItem = typeof tabItems.$inferSelect;
export type SuperlativeVote = typeof superlativeVotes.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type DomainEvent = typeof domainEvents.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type Connection = typeof connections.$inferSelect;
