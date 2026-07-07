"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

export function CancelTicketButton({ ticketId, eventId }: { ticketId: string; eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="text-sm text-[color:var(--color-ink-faint)] underline underline-offset-2"
      disabled={pending}
      onClick={() => {
        if (!confirm("Cancel your seat? It will be offered to the waitlist.")) return;
        startTransition(async () => {
          await toolAction("cancel_ticket", { ticketId }, [`/e/${eventId}`]);
          router.refresh();
        });
      }}
    >
      {pending ? "Cancelling…" : "Can't make it? Cancel your seat"}
    </button>
  );
}
