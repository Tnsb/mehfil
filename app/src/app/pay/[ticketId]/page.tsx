/**
 * Mock checkout — stands in for Stripe when no STRIPE_SECRET_KEY is set,
 * so the paid flow works end-to-end with zero setup.
 */
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { PayButton } from "./pay-button";

export const dynamic = "force-dynamic";

export default async function MockPayPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/pay/${ticketId}`);

  const [ticket] = await db.select().from(tables.tickets).where(eq(tables.tickets.id, ticketId));
  if (!ticket || ticket.userId !== user.id) notFound();
  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, ticket.eventId));
  if (!event) notFound();

  if (ticket.status === "paid") redirect(`/e/${event.id}/success?ticket=${ticket.id}`);
  if (ticket.status !== "pending") redirect(`/e/${event.id}`);

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-10">
        <p className="pill bg-[color:var(--color-butter-soft)] mb-4">demo checkout — no real card needed</p>
        <h1 className="font-display text-3xl font-semibold">Lock your seat</h1>
        <p className="text-[color:var(--color-ink-soft)] mt-1">
          {event.title} · {formatDateTime(event.startsAt)}
        </p>

        <div className="card p-6 mt-6 space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold">1 seat</span>
            <span className="font-display text-2xl font-semibold">{formatPrice(event.priceCents)}</span>
          </div>
          <div className="space-y-3 opacity-60 pointer-events-none select-none">
            <input className="field" defaultValue="4242 4242 4242 4242" readOnly />
            <div className="grid grid-cols-2 gap-3">
              <input className="field" defaultValue="12 / 29" readOnly />
              <input className="field" defaultValue="424" readOnly />
            </div>
          </div>
          <PayButton ticketId={ticket.id} eventId={event.id} label={`Pay ${formatPrice(event.priceCents)}`} />
          <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
            Set STRIPE_SECRET_KEY to swap this for real Stripe Checkout.
          </p>
        </div>
      </div>
    </Shell>
  );
}
