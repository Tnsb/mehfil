"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

export function ClaimButton({ claimCode, eventId }: { claimCode: string; eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        className="btn btn-primary w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction("claim_duo_seat", { claimCode });
            if (!res.ok) return setError(res.error);
            router.push(`/e/${eventId}`);
          })
        }
      >
        {pending ? "Claiming your seat…" : "👯 Claim my seat"}
      </button>
      {error ? (
        <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium text-center">{error}</p>
      ) : null}
    </div>
  );
}
