"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

export function SettingsForm({
  initialIgHandle,
  initialShare,
}: {
  initialIgHandle: string | null;
  initialShare: boolean;
}) {
  const router = useRouter();
  const [igHandle, setIgHandle] = useState(initialIgHandle ?? "");
  const [share, setShare] = useState(initialShare);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(undefined);
          const res = await toolAction("set_profile", {
            igHandle,
            shareHandleOnMatch: share,
          });
          if (!res.ok) return setError(res.error);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
          router.refresh();
        });
      }}
    >
      <div>
        <label className="block text-sm font-semibold mb-1.5">Instagram handle</label>
        <input
          className="field"
          placeholder="@yourhandle"
          value={igHandle}
          onChange={(e) => setIgHandle(e.target.value)}
        />
      </div>
      <label className="flex items-start gap-2.5 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong>Auto-exchange on match.</strong> When a Tap matches, the Cohost drops both
          handles into the chat — only if you both opted in.
        </span>
      </label>
      {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
      <button className="btn btn-ink w-full" disabled={pending} type="submit">
        {saved ? "Saved ✓" : pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
