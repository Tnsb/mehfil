/**
 * A match's private chat: only the two people in the (same-intent) mutual
 * tap can see it. The Cohost has already opened it with context.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { runTool } from "@/agent/registry";
import { getCurrentUser } from "@/lib/auth";
import { MatchRoom } from "./match-room";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ eventId: string; otherUserId: string }>;
}) {
  const { eventId, otherUserId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/match/${eventId}/${otherUserId}`);

  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, eventId));
  const [other] = await db.select().from(tables.users).where(eq(tables.users.id, otherUserId));
  if (!event || !other) notFound();

  const ctx = { userId: user.id, name: user.name ?? user.email, isSystem: false };
  const res = await runTool("get_match_chat", ctx, { eventId, otherUserId });
  // the tool refuses unless a same-intent mutual tap exists — nothing leaks
  if (!res.ok) redirect(`/drop/${eventId}`);
  const chat = res.data as {
    intentLabel: string;
    messages: never[];
  };

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div className="card p-5 !bg-[color:var(--color-grape-soft)] rise-in text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-grape)]">
            {chat.intentLabel} match
          </p>
          <h1 className="font-display text-2xl font-semibold mt-1">
            You + {other.name ?? "Guest"}
          </h1>
          <p className="text-sm text-[color:var(--color-ink-soft)] mt-1">
            You both tapped after <strong>{event.title}</strong> — neither of you would&apos;ve
            known otherwise.
          </p>
        </div>

        <MatchRoom eventId={eventId} otherUserId={otherUserId} initialMessages={chat.messages} />

        <p className="text-center">
          <Link
            href={`/drop/${eventId}`}
            className="text-sm font-semibold text-[color:var(--color-grape)] underline underline-offset-2"
          >
            ← back to the Drop
          </Link>
        </p>
      </div>
    </Shell>
  );
}
