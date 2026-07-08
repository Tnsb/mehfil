"use client";

/**
 * One Shot capture: opens the camera/gallery, then renders the photo as a
 * film still CLIENT-SIDE — theme film stock filter, grain, frame (letterbox /
 * polaroid / vhs), and the event title + date burned in. What gets stored is
 * already the still; there is no "original".
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";
import type { FilmStock } from "@/themes";

function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number, opacity: number) {
  const noise = document.createElement("canvas");
  const nw = Math.max(64, Math.round(w / 4));
  const nh = Math.max(64, Math.round(h / 4));
  noise.width = nw;
  noise.height = nh;
  const nctx = noise.getContext("2d")!;
  const img = nctx.createImageData(nw, nh);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = "overlay";
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(noise, 0, 0, w, h);
  ctx.restore();
}

export async function renderFilmStill(
  file: File,
  stock: FilmStock,
  title: string,
  maxDim = 900,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const iw = Math.round(bitmap.width * scale);
  const ih = Math.round(bitmap.height * scale);

  const pad = stock.frame === "polaroid" ? Math.round(iw * 0.06) : 0;
  const bottomPad =
    stock.frame === "polaroid"
      ? Math.round(ih * 0.22)
      : stock.frame === "letterbox"
        ? Math.round(ih * 0.14)
        : 0;
  const topPad = stock.frame === "letterbox" ? Math.round(ih * 0.14) : pad;

  const canvas = document.createElement("canvas");
  canvas.width = iw + pad * 2;
  canvas.height = ih + topPad + bottomPad + (stock.frame === "polaroid" ? 0 : 0);
  const ctx = canvas.getContext("2d")!;

  // frame background
  ctx.fillStyle = stock.frame === "polaroid" ? "#faf6ee" : "#0a0a0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // the photo, through the film stock
  ctx.save();
  ctx.filter = stock.filter;
  ctx.drawImage(bitmap, pad, topPad, iw, ih);
  ctx.restore();

  // grain over the photo area
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, topPad, iw, ih);
  ctx.clip();
  addGrain(ctx, canvas.width, canvas.height, stock.grain);
  // soft vignette
  const vg = ctx.createRadialGradient(
    canvas.width / 2, topPad + ih / 2, Math.min(iw, ih) * 0.35,
    canvas.width / 2, topPad + ih / 2, Math.max(iw, ih) * 0.75,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vg;
  ctx.fillRect(pad, topPad, iw, ih);
  ctx.restore();

  // vhs scanlines
  if (stock.frame === "vhs") {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#000";
    for (let y = topPad; y < topPad + ih; y += 4) ctx.fillRect(pad, y, iw, 1.5);
    ctx.restore();
  }

  // burned-in text
  const stamp = new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const small = Math.max(11, Math.round(iw * 0.026));
  if (stock.frame === "polaroid") {
    ctx.fillStyle = "#2b2620";
    ctx.font = `600 ${Math.round(small * 1.3)}px Georgia, serif`;
    ctx.fillText(title.toUpperCase().slice(0, 40), pad, topPad + ih + Math.round(bottomPad * 0.45));
    ctx.fillStyle = "#8a8378";
    ctx.font = `${small}px Georgia, serif`;
    ctx.fillText(`${stamp} · ${stock.name}`, pad, topPad + ih + Math.round(bottomPad * 0.75));
  } else {
    ctx.fillStyle = stock.burnColor;
    ctx.font = `600 ${Math.round(small * 1.2)}px ui-monospace, monospace`;
    ctx.fillText(title.toUpperCase().slice(0, 40), pad + Math.round(iw * 0.03), canvas.height - Math.round(bottomPad * 0.4));
    ctx.textAlign = "right";
    ctx.font = `${small}px ui-monospace, monospace`;
    ctx.fillText(
      stock.frame === "vhs" ? `● REC ${stamp}` : `${stamp} · ${stock.name}`,
      canvas.width - pad - Math.round(iw * 0.03),
      canvas.height - Math.round(bottomPad * 0.4),
    );
    ctx.textAlign = "left";
  }

  return canvas.toDataURL("image/jpeg", 0.82);
}

export function OneShotButton({
  eventId,
  eventTitle,
  filmStock,
  alreadyShot,
  started,
  needsCheckIn,
}: {
  eventId: string;
  eventTitle: string;
  filmStock: FilmStock;
  alreadyShot: boolean;
  started: boolean;
  needsCheckIn?: boolean;
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
  if (needsCheckIn) {
    return (
      <div className="pill bg-[color:var(--color-butter-soft)]">
        📸 Check in at the door to unlock your One Shot
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
              const dataUrl = await renderFilmStill(file, filmStock, eventTitle);
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
        {pending ? "Sealing it in the roll…" : `📸 Use your One Shot (${filmStock.name})`}
      </button>
      {status ? (
        <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium text-center">{status}</p>
      ) : null}
      <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
        One photo. No retakes. Shot on {filmStock.name} — the roll develops the morning after.
      </p>
    </div>
  );
}
