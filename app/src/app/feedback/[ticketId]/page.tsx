import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/feedback/${ticketId}`);

  const [ticket] = await db.select().from(tables.tickets).where(eq(tables.tickets.id, ticketId));
  if (!ticket || ticket.userId !== user.id) notFound();
  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, ticket.eventId));
  if (!event) notFound();

  const [existing] = await db
    .select()
    .from(tables.feedback)
    .where(eq(tables.feedback.ticketId, ticket.id));

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="pill bg-[color:var(--color-grape-soft)] text-[color:var(--color-grape)] mb-3">✨ AfterParty</p>
        <h1 className="font-display text-3xl font-semibold [text-wrap:balance]">
          How was {event.title}?
        </h1>
        <p className="text-[color:var(--color-ink-soft)] mt-1 mb-6">30 seconds, while it&apos;s fresh.</p>
        {existing ? (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-display text-xl font-semibold">You already rated this one {existing.rating}★</p>
            <p className="text-sm text-[color:var(--color-ink-soft)] mt-1">Thanks for the feedback.</p>
          </div>
        ) : (
          <FeedbackForm ticketId={ticket.id} />
        )}
      </div>
    </Shell>
  );
}
