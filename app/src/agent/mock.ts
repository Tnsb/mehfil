/**
 * Deterministic mock agent — used when ANTHROPIC_API_KEY is not set, so the
 * full product (including chat) demos with zero credentials. It parses a few
 * intents with heuristics and calls the SAME tool registry the real agent
 * uses, streaming proper UI-message chunks (text + tool calls).
 */
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { runTool } from "./registry";
import type { ActorContext, ToolResult } from "./types";

function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
}

async function callTool(
  writer: UIMessageStreamWriter,
  ctx: ActorContext,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const toolCallId = `mock_${Math.random().toString(36).slice(2, 10)}`;
  writer.write({ type: "tool-input-available", toolCallId, toolName: name, input, dynamic: true });
  const result = await runTool(name, ctx, input);
  writer.write({ type: "tool-output-available", toolCallId, output: result, dynamic: true });
  return result;
}

function say(writer: UIMessageStreamWriter, text: string) {
  const id = `txt_${Math.random().toString(36).slice(2, 10)}`;
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

/* ---- tiny parsers for the create-event intent ---- */

function parsePrice(text: string): number {
  const m = text.match(/\$\s?(\d+(?:\.\d{1,2})?)/) ?? text.match(/(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks|usd)/i);
  return m ? parseFloat(m[1]) : 0;
}

function parseCapacity(text: string): number {
  const m = text.match(/(\d+)\s*(?:seats?|people|guests?|spots?|heads)/i);
  return m ? parseInt(m[1], 10) : 8;
}

function parseDate(text: string): Date {
  const lower = text.toLowerCase();
  const now = new Date();
  const at = (d: Date) => {
    const timeMatch = lower.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(pm|am)/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      if (timeMatch[3].toLowerCase() === "pm" && h < 12) h += 12;
      d.setHours(h, timeMatch[2] ? parseInt(timeMatch[2], 10) : 0, 0, 0);
    } else {
      d.setHours(19, 0, 0, 0); // dinners default to 7pm
    }
    return d;
  };

  const iso = text.match(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?/);
  if (iso) {
    const d = new Date(iso[0]);
    if (!isNaN(d.getTime())) return iso[0].includes("T") ? d : at(d);
  }
  if (lower.includes("tonight") || lower.includes("today")) return at(new Date(now));
  if (lower.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return at(d);
  }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < 7; i++) {
    if (lower.includes(days[i])) {
      const d = new Date(now);
      const delta = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + delta);
      return at(d);
    }
  }
  // default: next Saturday, 7pm
  const d = new Date(now);
  d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
  return at(d);
}

function titleFrom(text: string): string {
  const cleaned = text
    .replace(/^(hey|hi|please|can you|i want to|i'd like to|let's|create|host|set ?up|make)\s+/gi, "")
    .replace(/\$\s?\d+(\.\d{1,2})?/g, "")
    .replace(/\d+\s*(seats?|people|guests?|spots?)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const short = cleaned.split(/[,.]/)[0].trim();
  const t = short.length >= 3 ? short : "An intimate dinner";
  return t.charAt(0).toUpperCase() + t.slice(1).slice(0, 80);
}

/* ---- the mock brain ---- */

export function streamMockResponse(ctx: ActorContext, messages: UIMessage[]) {
  const text = lastUserText(messages);
  const lower = text.toLowerCase();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });

      const signedOut = !ctx.userId;
      const wants = (...words: string[]) => words.some((w) => lower.includes(w));

      try {
        if (wants("what's happening", "whats happening", "discover", "find event", "upcoming", "what can i", "browse")) {
          const res = await callTool(writer, ctx, "discover_events", {});
          if (res.ok) {
            const events = (res.data as { events: { title: string; price: string; startsAt: string; seatsLeft?: number; url: string }[] }).events;
            say(
              writer,
              events.length === 0
                ? "Nothing on the calendar yet. Know someone who should be hosting?"
                : `Here's what's coming up:\n\n${events
                    .map(
                      (e) =>
                        `• **${e.title}** — ${e.price}, ${new Date(e.startsAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${e.seatsLeft} seats left → [open](${e.url})`,
                    )
                    .join("\n")}`,
            );
          } else say(writer, res.error);
        } else if (wants("publish") || (wants("accept") && wants("terms"))) {
          if (signedOut) return say(writer, "Sign in first, then I can publish for you.");
          const list = await callTool(writer, ctx, "list_my_events", {});
          const draft = list.ok
            ? (list.data as { events: { id: string; status: string; title: string }[] }).events.find((e) => e.status === "draft")
            : undefined;
          if (!draft) return say(writer, "No draft events to publish. Describe a dinner and I'll set one up.");
          if (!wants("accept", "agree", "yes")) {
            return say(
              writer,
              `Before I publish **${draft.title}**: by publishing you accept the hosting terms — you confirm you're allowed to run this event (I surface compliance info, never legal verdicts). Reply "publish and accept terms" to go live.`,
            );
          }
          const res = await callTool(writer, ctx, "publish_event", { eventId: draft.id, acceptTerms: true });
          say(
            writer,
            res.ok
              ? `**${draft.title}** is live! Share the link: [/e/${draft.id}](/e/${draft.id}) — the address stays hidden until a guest pays.`
              : res.error,
          );
        } else if (wants("who's coming", "whos coming", "roster", "guest list", "how are my", "my events")) {
          if (signedOut) return say(writer, "Sign in and I'll pull up your events.");
          const list = await callTool(writer, ctx, "list_my_events", {});
          const events = list.ok ? (list.data as { events: { id: string; title: string; status: string; seatsTaken: number; capacity: number; hostUrl: string }[] }).events : [];
          if (events.length === 0) return say(writer, "You're not hosting anything yet. Describe a dinner — one sentence is enough.");
          if (wants("roster", "who's coming", "whos coming", "guest list")) {
            const active = events.find((e) => e.status === "published" || e.status === "sold_out") ?? events[0];
            const res = await callTool(writer, ctx, "get_event_roster", { eventId: active.id });
            if (res.ok) {
              const d = res.data as { confirmed: { name: string; answers: Record<string, string> }[]; waitlist: unknown[]; revenue: string; event: { title: string } };
              say(
                writer,
                `**${d.event.title}** — ${d.confirmed.length} confirmed, ${d.waitlist.length} waitlisted, ${d.revenue} in.\n\n${d.confirmed.map((g) => `• ${g.name}${g.answers?.dietary ? ` — ${g.answers.dietary}` : ""}`).join("\n") || "No confirmed guests yet."}`,
              );
            } else say(writer, res.error);
          } else {
            say(
              writer,
              `Your events:\n\n${events.map((e) => `• **${e.title}** — ${e.status}, ${e.seatsTaken}/${e.capacity} seats → [manage](${e.hostUrl})`).join("\n")}`,
            );
          }
        } else if (wants("wrap up", "afterparty", "after party")) {
          if (signedOut) return say(writer, "Sign in and I'll wrap up your last dinner.");
          const list = await callTool(writer, ctx, "list_my_events", {});
          const past = list.ok
            ? (list.data as { events: { id: string; title: string; status: string; startsAt: string }[] }).events.find(
                (e) => (e.status === "published" || e.status === "sold_out") && new Date(e.startsAt) < new Date(),
              )
            : undefined;
          if (!past) return say(writer, "No finished events to wrap up. The AfterParty fires automatically ~12h after each dinner anyway.");
          const res = await callTool(writer, ctx, "run_afterparty", { eventId: past.id });
          say(writer, res.ok ? (res.data as { message: string }).message : res.error);
        } else if (wants("how did", "summary", "feedback for", "ratings")) {
          if (signedOut) return say(writer, "Sign in and I'll pull the AfterParty summary.");
          const list = await callTool(writer, ctx, "list_my_events", {});
          const done = list.ok
            ? (list.data as { events: { id: string; status: string }[] }).events.find((e) => e.status === "completed")
            : undefined;
          if (!done) return say(writer, "No completed events yet — the AfterParty summary appears after a dinner wraps.");
          const res = await callTool(writer, ctx, "get_afterparty_summary", { eventId: done.id });
          if (res.ok) {
            const d = res.data as { event: { title: string }; guests: number; responses: number; responseRate: string; averageRating: number | null; repeatGuests: number; comments: { guest: string; rating: number; comment: string | null; visibility: string }[]; suggestion: string };
            say(
              writer,
              `**${d.event.title}** — ${d.guests} guests, ${d.responseRate} responded${d.averageRating ? `, ${d.averageRating}★ average` : ""}. ${d.repeatGuests} repeat guest${d.repeatGuests === 1 ? "" : "s"}.\n\n${d.comments.map((c) => `• ${"★".repeat(c.rating)} ${c.guest}${c.comment ? ` — "${c.comment}"` : ""} (${c.visibility})`).join("\n") || "No comments yet."}\n\n${d.suggestion}`,
            );
          } else say(writer, res.error);
        } else if (wants("run it back", "run back", "same time next week", "rebook")) {
          if (signedOut) return say(writer, "Sign in and I'll set up the sequel.");
          const list = await callTool(writer, ctx, "list_my_events", {});
          const done = list.ok
            ? (list.data as { events: { id: string; title: string; status: string }[] }).events.find((e) => e.status === "completed")
            : undefined;
          if (!done) return say(writer, "Nothing to run back yet — that unlocks once an event completes.");
          const res = await callTool(writer, ctx, "run_it_back", { eventId: done.id });
          if (res.ok) {
            const d = res.data as { event: { id: string; title: string; startsAt: string; hostUrl: string } };
            say(
              writer,
              `Sequel drafted: **${d.event.title}** on ${new Date(d.event.startsAt).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Say **"publish and accept terms"** and everyone from last time gets first access. [Manage it](${d.event.hostUrl}).`,
            );
          } else say(writer, res.error);
        } else if (wants("vibe", "cohost personality", "butler", "hype man", "bestie")) {
          if (signedOut) return say(writer, "Sign in and I'll retune your Cohost.");
          const vibe = wants("butler", "formal") ? "formal_butler" : wants("hype") ? "hype_man" : "chaotic_bestie";
          const list = await callTool(writer, ctx, "list_my_events", {});
          const active = list.ok
            ? (list.data as { events: { id: string; title: string; status: string }[] }).events.find((e) => e.status !== "completed" && e.status !== "cancelled")
            : undefined;
          if (!active) return say(writer, "No active event to retune. Create one first!");
          const res = await callTool(writer, ctx, "set_cohost_vibe", { eventId: active.id, vibe });
          say(writer, res.ok ? `${(res.data as { message: string }).message} It'll speak that way in **${active.title}**'s party chat.` : res.error);
        } else if (wants("wrapped", "my stats", "how many nights", "people met", "connections")) {
          if (signedOut) return say(writer, "Sign in and I'll pull your Wrapped.");
          if (wants("connections", "people met", "who did i meet", "matches")) {
            const res = await callTool(writer, ctx, "get_my_connections", {});
            if (res.ok) {
              const cs = (res.data as { connections: { name: string; intent: string; metAt: string; chatUrl: string }[] }).connections;
              return say(
                writer,
                cs.length === 0
                  ? "No matches yet — Taps open on the Drop page for 48h after each night. Pick a lane: 🫶 vibe, ⚡ collab, or 💘 crush."
                  : `Your matches:\n\n${cs.map((c) => `• **${c.name}** — ${c.intent}, met at ${c.metAt} → [chat](${c.chatUrl})`).join("\n")}`,
              );
            }
            return say(writer, res.error);
          }
          const res = await callTool(writer, ctx, "get_my_wrapped", {});
          if (res.ok) {
            const w = res.data as { nightsOut: number; nightsHosted: number; topHost: { name: string; count: number } | null; oneShotsTaken: number; peopleMet: number };
            say(
              writer,
              `Your TABLE Wrapped:\n\n• ${w.nightsOut} night${w.nightsOut === 1 ? "" : "s"} out · ${w.nightsHosted} hosted\n${w.topHost ? `• Night #${w.topHost.count} at ${w.topHost.name}'s is in the books\n` : ""}• ${w.oneShotsTaken} One Shot${w.oneShotsTaken === 1 ? "" : "s"} taken · ${w.peopleMet} people met`,
            );
          } else say(writer, res.error);
        } else if (wants("my tickets", "am i going", "what am i going")) {
          if (signedOut) return say(writer, "Sign in and I'll show your tickets.");
          const res = await callTool(writer, ctx, "get_my_tickets", {});
          if (res.ok) {
            const ts = (res.data as { tickets: { status: string; event: { title: string; startsAt: string; url: string } }[] }).tickets;
            say(
              writer,
              ts.length === 0
                ? "No tickets yet. Ask me \"what's happening?\" to find a table."
                : `Your tickets:\n\n${ts.map((t) => `• **${t.event.title}** — ${t.status}, ${new Date(t.event.startsAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} → [open](${t.event.url})`).join("\n")}`,
            );
          } else say(writer, res.error);
        } else if (wants("dinner", "supper", "event", "party", "brunch", "tasting", "host") && wants("create", "host", "set up", "setup", "make", "plan", "seats", "$")) {
          if (signedOut) return say(writer, "Sign in first — then describe your dinner in one sentence and I'll build it.");
          const input = {
            title: titleFrom(text),
            priceDollars: parsePrice(text),
            capacity: parseCapacity(text),
            startsAtIso: parseDate(text).toISOString(),
            vibe: undefined as string | undefined,
          };
          const res = await callTool(writer, ctx, "create_event", input);
          if (res.ok) {
            const e = (res.data as { event: { id: string; title: string; price: string; capacity: number; startsAt: string; url: string } }).event;
            say(
              writer,
              `Draft ready: **${e.title}** — ${e.price} · ${e.capacity} seats · ${new Date(e.startsAt).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.\n\nPreview it at [${e.url}](${e.url}). Add the address on the manage page so it can be revealed to paid guests.\n\nWhen it looks right, say **"publish and accept terms"** to go live.`,
            );
          } else say(writer, res.error);
        } else {
          say(
            writer,
            signedOut
              ? `I'm the TABLE crew — I run paid dinners end to end. Try:\n\n• "What's happening this week?"\n• Sign in, then: "Host a six-course Oaxacan dinner Saturday, 10 seats, $85"`
              : `I run your parties end to end. Try:\n\n• "Host a six-course Oaxacan dinner Saturday, 10 seats, $85"\n• "Who's coming to my dinner?"\n• "Make my cohost a formal butler"\n• "Run it back" · "Show my wrapped" · "How did it go?"\n\n(Heads up: I'm in offline mode — set ANTHROPIC_API_KEY for the full agent.)`,
          );
        }
      } catch (e) {
        console.error("[mock agent]", e);
        say(writer, "Something went wrong on my side. Try that again?");
      } finally {
        writer.write({ type: "finish" });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
