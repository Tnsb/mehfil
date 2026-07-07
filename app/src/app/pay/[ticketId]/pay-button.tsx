"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PayButton({
  ticketId,
  eventId,
  label,
}: {
  ticketId: string;
  eventId: string;
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        className="btn btn-primary w-full"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            setError(undefined);
            router.push(`/e/${eventId}/success?ticket=${ticketId}`);
          })
        }
      >
        {pending ? "Processing…" : label}
      </button>
      {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)]">{error}</p> : null}
    </div>
  );
}
