"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, ImageSquare, ShareNetwork, X } from "@phosphor-icons/react/ssr";
import { sfx } from "@/lib/sound";

type Format = "story" | "square";

/**
 * "Make a card": a poster-style image of a plan or shortlist, sized for
 * Instagram Stories or WhatsApp. Shares the image itself where the browser
 * can (phones), otherwise downloads it.
 */
export default function ShareCard({ ids, title, kicker, label = "Share card" }: { ids: string[]; title: string; kicker?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("story");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const qs = new URLSearchParams({ ids: ids.slice(0, 6).join(","), title, format, ...(kicker ? { kicker } : {}) });
  const src = `/api/card?${qs}`;
  const file = `elsewhere-${format}.png`;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const share = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(src)).blob();
      const f = new File([blob], file, { type: "image/png" });
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      sfx("pop");
    } catch {
      /* cancelled or failed; the download link still works */
    } finally {
      setBusy(false);
    }
  };

  if (!ids.length) return null;
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <ImageSquare size={17} weight="bold" aria-hidden="true" /> {label}
      </button>
      <dialog ref={dialog} className="sharecard" aria-label="Share card" onClose={() => setOpen(false)} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        {open && (
          <div className="sharecard-body">
            <div className="sharecard-head">
              <h2>Share as a picture</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={18} weight="bold" />
              </button>
            </div>
            <div className="sharecard-tabs" role="radiogroup" aria-label="Card size">
              {(["story", "square"] as Format[]).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={format === f} className={format === f ? "is-on" : ""} onClick={() => setFormat(f)}>
                  {f === "story" ? "Story 9:16" : "Square 1:1"}
                </button>
              ))}
            </div>
            <div className={`sharecard-preview is-${format}`}>
              {loaded !== src && <span className="skel sharecard-skel" aria-hidden="true" />}
              <img src={src} alt={`Preview of the ${format} card`} onLoad={() => setLoaded(src)} />
            </div>
            <div className="sharecard-actions">
              <button type="button" className="btn btn-primary" onClick={share} disabled={busy}>
                <ShareNetwork size={17} weight="bold" aria-hidden="true" /> {busy ? "Preparing…" : "Share image"}
              </button>
              <a className="btn btn-ghost" href={src} download={file}>
                <DownloadSimple size={17} weight="bold" aria-hidden="true" /> Download
              </a>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
