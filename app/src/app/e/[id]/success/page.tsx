/**
 * Payment success — the "wax seal" address reveal.
 * Confirms the payment server-side (idempotent), then reveals the address.
 * Mock provider: arrives with ?ticket=; Stripe: also carries ?session_id=.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { runTool } from "@/agent/registry";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ticket?: string; session_id?: string }>;
}) {
  const { id } = await params;
  const { ticket: ticketId, session_id } = await searchParams;
  const user = await getCurrentUser();
  if (!user || !ticketId) notFound();

  const result = await runTool(
    "confirm_payment",
    { userId: user.id, name: user.name ?? user.email, isSystem: false },
    { ticketId, providerRef: session_id },
  );

  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, id));
  if (!event) notFound();

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-14 text-center">
        {result.ok ? (
          <div className="reveal-open">
            <p className="text-5xl mb-4">🎟️</p>
            <h1 className="font-display text-4xl font-semibold [text-wrap:balance]">
              You&apos;re at the table.
            </h1>
            <p className="mt-2 text-[color:var(--color-ink-soft)]">
              {event.title} · {formatDateTime(event.startsAt)}
            </p>
            <div className="card p-6 mt-7 !bg-[color:var(--color-butter-soft)]">
              <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-ink-soft)]">
                The address, unsealed
              </p>
              <p className="font-display text-2xl font-semibold mt-2">
                {event.locationAddress ?? "Your host will share it in the group"}
              </p>
            </div>
            <div className="mt-7 flex flex-col gap-2">
              <Link href={`/party/${event.id}`} className="btn btn-grape">
                💬 Join the party chat — your Cohost is waiting
              </Link>
              <Link href={`/e/${event.id}`} className="btn btn-primary">
                View your ticket
              </Link>
              <Link href="/" className="btn btn-ghost">
                Explore more tables
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-5xl mb-4">😵‍💫</p>
            <h1 className="font-display text-3xl font-semibold">Payment not confirmed</h1>
            <p className="mt-2 text-[color:var(--color-ink-soft)]">{result.error}</p>
            <Link href={`/e/${event.id}`} className="btn btn-primary mt-6">
              Back to the event
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}
