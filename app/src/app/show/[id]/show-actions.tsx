"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

export function CloseSeasonButton({ showId, season }: { showId: string; season: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        className="pill bg-[color:var(--color-ink)] text-[color:var(--color-cream)] cursor-pointer disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Wrap season ${season}? The finale goes live and the next season starts filming.`)) return;
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction("close_season", { showId });
            if (!res.ok) return setError(res.error);
            const data = res.data as { finaleUrl: string };
            router.push(data.finaleUrl);
          });
        }}
      >
        {pending ? "Wrapping…" : `🎬 Wrap season ${season}`}
      </button>
      {error ? <span className="text-xs text-[color:var(--color-tangerine-deep)]">{error}</span> : null}
    </span>
  );
}
