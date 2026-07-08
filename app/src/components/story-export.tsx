"use client";

/**
 * Story-still export: renders a 1080×1920 share card (photo + episode title
 * card + plot watermark) on a canvas and downloads it. Cinema for the feed.
 */
export function StoryExportButton({
  dataUrl,
  eventTitle,
  titleCard,
  dateLabel,
  palette,
}: {
  dataUrl: string;
  eventTitle: string;
  titleCard?: string | null;
  dateLabel: string;
  palette: { from: string; to: string };
}) {
  async function exportStill() {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });

    const W = 1080;
    const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, palette.from);
    bg.addColorStop(1, palette.to);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, W, H);

    // the still, centered with a frame
    const maxW = W * 0.86;
    const maxH = H * 0.55;
    const s = Math.min(maxW / img.width, maxH / img.height);
    const iw = img.width * s;
    const ih = img.height * s;
    const ix = (W - iw) / 2;
    const iy = H * 0.16;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(ix - 16, iy - 16, iw + 32, ih + 32);
    ctx.restore();
    ctx.drawImage(img, ix, iy, iw, ih);

    // episode title card
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    if (titleCard) {
      ctx.font = "500 34px Georgia, serif";
      ctx.globalAlpha = 0.85;
      ctx.fillText("— an episode titled —", W / 2, iy + ih + 130);
      ctx.globalAlpha = 1;
      ctx.font = "600 72px Georgia, serif";
      ctx.fillText(`“${titleCard}”`, W / 2, iy + ih + 220, W * 0.9);
    } else {
      ctx.font = "600 64px Georgia, serif";
      ctx.fillText(eventTitle, W / 2, iy + ih + 180, W * 0.9);
    }
    ctx.font = "500 34px ui-monospace, monospace";
    ctx.globalAlpha = 0.8;
    ctx.fillText(dateLabel.toUpperCase(), W / 2, H - 200);
    ctx.globalAlpha = 1;
    ctx.font = "700 40px Georgia, serif";
    ctx.fillText("plot.", W / 2, H - 120);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/jpeg", 0.9);
    a.download = "plot-story-still.jpg";
    a.click();
  }

  return (
    <button type="button" className="pill bg-white/80 hover:bg-white transition text-xs" onClick={exportStill}>
      ↗ Export story still
    </button>
  );
}
