/**
 * Notification records + delivery adapters.
 *
 * `notify()` writes a Notification record, then hands it to the adapter for
 * its channel. Adding push/SMS/WhatsApp later = one new adapter entry here.
 * Nothing upstream (rules, tools, UI) changes.
 */
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/ids";
import type { Notification } from "@/db/schema";

export type NotifyInput = {
  userId: string;
  templateKey: string;
  title: string;
  body: string;
  href?: string;
  channel?: string;
  /** future notifications stay "queued" until the scheduler tick delivers them */
  scheduledFor?: Date;
};

type ChannelAdapter = {
  deliver: (n: Notification) => Promise<void>;
};

const adapters: Record<string, ChannelAdapter> = {
  // v1: in-app inbox. The record IS the delivery; nothing else to do.
  in_app: { deliver: async () => {} },
  // dev visibility
  console: {
    deliver: async (n) => {
      console.log(`[notify:${n.userId}] ${n.title} — ${n.body}`);
    },
  },
  // later: push: { deliver: sendWebPush }, sms: { deliver: sendTwilio }, ...
};

export async function notify(input: NotifyInput): Promise<void> {
  const id = newId("ntf");
  const channel = input.channel ?? "in_app";
  const scheduled = input.scheduledFor && input.scheduledFor > new Date();

  await db.insert(tables.notifications).values({
    id,
    userId: input.userId,
    channel,
    templateKey: input.templateKey,
    title: input.title,
    body: input.body,
    href: input.href,
    status: "queued",
    scheduledFor: input.scheduledFor,
  });

  if (!scheduled) await deliverNow(id);
}

export async function deliverNow(notificationId: string): Promise<void> {
  const [n] = await db
    .select()
    .from(tables.notifications)
    .where(eq(tables.notifications.id, notificationId));
  if (!n || n.status === "sent") return;

  const adapter = adapters[n.channel] ?? adapters.in_app;
  try {
    await adapter.deliver(n);
    await db
      .update(tables.notifications)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(tables.notifications.id, n.id));
  } catch (err) {
    console.error(`[notifications] delivery failed for ${n.id}:`, err);
    await db
      .update(tables.notifications)
      .set({ status: "failed" })
      .where(eq(tables.notifications.id, n.id));
  }
}
