/**
 * The Tab — shared-cost splitting inside the night's context.
 * "Log $60 for pizza" → even split across attendees → payment requests
 * with the memory attached, not a cold Splitwise ledger.
 */
import { z } from "zod";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, tables } from "@/db";
import { newId } from "@/lib/ids";
import { notify } from "@/notifications/deliver";
import { defineTool, ok, err, requireUser, ToolError } from "../types";
import { getEventOrThrow, hasPartyAccess, formatPrice } from "./helpers";

/** attendees = checked-in guests + host; falls back to all paid guests + host */
async function tabParticipants(eventId: string, hostId: string): Promise<string[]> {
  const checkedIn = await db
    .select({ userId: tables.tickets.userId })
    .from(tables.tickets)
    .where(
      and(
        eq(tables.tickets.eventId, eventId),
        eq(tables.tickets.status, "paid"),
        isNotNull(tables.tickets.checkedInAt),
      ),
    );
  let ids = checkedIn.map((r) => r.userId);
  if (ids.length === 0) {
    const paid = await db
      .select({ userId: tables.tickets.userId })
      .from(tables.tickets)
      .where(and(eq(tables.tickets.eventId, eventId), eq(tables.tickets.status, "paid")));
    ids = paid.map((r) => r.userId);
  }
  return [...new Set([hostId, ...ids])];
}

type TabSummary = {
  items: { id: string; label: string; amount: string; paidBy: string }[];
  total: string;
  perHead: string;
  balances: { userId: string; name: string; netCents: number; net: string }[];
};

export async function computeTab(eventId: string, hostId: string): Promise<TabSummary> {
  const items = await db
    .select({ item: tables.tabItems, payer: tables.users })
    .from(tables.tabItems)
    .innerJoin(tables.users, eq(tables.tabItems.userId, tables.users.id))
    .where(eq(tables.tabItems.eventId, eventId))
    .orderBy(asc(tables.tabItems.createdAt));

  const participants = await tabParticipants(eventId, hostId);
  const totalCents = items.reduce((s, r) => s + r.item.amountCents, 0);
  const shareCents = participants.length > 0 ? Math.round(totalCents / participants.length) : 0;

  const paidByUser: Record<string, number> = {};
  for (const r of items) paidByUser[r.item.userId] = (paidByUser[r.item.userId] ?? 0) + r.item.amountCents;

  const users = participants.length
    ? await db.select().from(tables.users).where(inArray(tables.users.id, participants))
    : [];
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "someone";

  return {
    items: items.map((r) => ({
      id: r.item.id,
      label: r.item.label,
      amount: formatPrice(r.item.amountCents),
      paidBy: r.payer.name ?? r.payer.email,
    })),
    total: formatPrice(totalCents),
    perHead: formatPrice(shareCents),
    balances: participants
      .map((id) => {
        const netCents = (paidByUser[id] ?? 0) - shareCents; // + is owed, - owes
        return { userId: id, name: nameOf(id), netCents, net: formatPrice(Math.abs(netCents)) };
      })
      .sort((a, b) => b.netCents - a.netCents),
  };
}

export const addTabItem = defineTool({
  name: "add_tab_item",
  description:
    "Log a shared cost on an event's Tab, e.g. 'log $60 for pizza'. The Tab splits evenly across attendees and turns into payment requests after the night. Anyone at the event can log what they paid for.",
  inputSchema: z.object({
    eventId: z.string(),
    label: z.string().min(2).describe("What it was, e.g. 'pizza', 'second wine run'"),
    amountDollars: z.number().positive(),
  }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("Only people at the event can add to the Tab.");

    await db.insert(tables.tabItems).values({
      id: newId("tab"),
      eventId: event.id,
      userId,
      label: input.label.trim(),
      amountCents: Math.round(input.amountDollars * 100),
    });

    const tab = await computeTab(event.id, event.hostId);
    return ok({
      message: `On the tab: ${input.label} (${formatPrice(Math.round(input.amountDollars * 100))}). Running total ${tab.total} — ${tab.perHead} a head.`,
      total: tab.total,
      perHead: tab.perHead,
    });
  },
});

export const getTab = defineTool({
  name: "get_tab",
  description:
    "Get an event's Tab: every logged cost, the even split per head, and who owes / is owed what. Attendees only.",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (!(await hasPartyAccess(userId, event)))
      throw new ToolError("The Tab is for people at the event.");
    return ok(await computeTab(event.id, event.hostId));
  },
});

export const requestTabPayments = defineTool({
  name: "request_tab_payments",
  description:
    "HOST ONLY: settle the Tab — everyone who owes money gets a payment request notification with their exact share and what it was for, attached to the memory of the night.",
  inputSchema: z.object({ eventId: z.string() }),
  agentCallable: true,
  execute: async (ctx, input) => {
    const userId = requireUser(ctx);
    const event = await getEventOrThrow(input.eventId);
    if (event.hostId !== userId && !ctx.isSystem)
      throw new ToolError("Only the host settles the Tab.");

    const tab = await computeTab(event.id, event.hostId);
    if (tab.items.length === 0) return err("The Tab is empty — nothing to settle.");

    const creditor = tab.balances[0]; // most out-of-pocket person collects
    const debtors = tab.balances.filter((b) => b.netCents < -50); // ignore rounding dust

    for (const d of debtors) {
      const amount = formatPrice(-d.netCents);
      await notify({
        userId: d.userId,
        templateKey: "tab_request",
        title: `💸 The Tab from ${event.title}`,
        body: `Your share is ${amount} (${tab.items.map((i) => i.label).join(", ")} — ${tab.perHead}/head). Send it to ${creditor.name}.`,
        href: `/drop/${event.id}`,
      });
    }

    return ok({
      requestsSent: debtors.length,
      collectsTo: creditor.name,
      message: `Tab settled: ${debtors.length} payment request${debtors.length === 1 ? "" : "s"} sent. ${creditor.name} collects.`,
    });
  },
});
