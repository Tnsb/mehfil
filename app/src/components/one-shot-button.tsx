"use client";

/**
 * One Shot capture: opens the camera/gallery, downscales client-side to a
 * compact JPEG data URL, and burns the guest's single shot via the tool.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

async function toDataUrl(file: File, maxDim = 900): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function OneShotButton({
  eventId,
  alreadyShot,
  started,
}: {
  eventId: string;
  alreadyShot: boolean;
  started: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | undefined>();
  const [used, setUsed] = useState(alreadyShot);
  const [pending, startTransition] = useTransition();

  if (used) {
    return (
      <div className="pill bg-[color:var(--color-ink)] text-[color:var(--color-cream)]">
        📸 Your One Shot is in the roll — it develops in the morning
      </div>
    );
  }
  if (!started) {
    return (
      <div className="pill bg-[color:var(--color-butter-soft)]">
        📸 One Shot unlocks when the night starts — you get exactly one
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          startTransition(async () => {
            setStatus(undefined);
            try {
              const dataUrl = await toDataUrl(file);
              const res = await toolAction("take_one_shot", { eventId, dataUrl });
              if (!res.ok) return setStatus(res.error);
              setUsed(true);
              router.refresh();
            } catch {
              setStatus("Couldn't read that photo — try another.");
            }
          });
        }}
      />
      <button
        className="btn btn-ink w-full"
        disabled={pending}
        onClick={() => {
          if (confirm("One photo for the whole night. No retakes. Is this the moment?"))
            fileRef.current?.click();
        }}
      >
        {pending ? "Sealing it in the roll…" : "📸 Use your One Shot"}
      </button>
      {status ? (
        <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium text-center">{status}</p>
      ) : null}
      <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
        One photo. No retakes. The roll develops the morning after.
      </p>
    </div>
  );
}
