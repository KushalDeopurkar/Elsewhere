"use client";

/**
 * Cursor companion for mouse users: a ring that trails the pointer, grows
 * over things you can click, shows a short label where one helps ("Open",
 * "Drag"), pulls buttons slightly towards it, and floats an event picture
 * over rows marked data-reveal-img. The system cursor always stays visible,
 * and none of this runs on touch screens or with reduced motion.
 *
 * Hooks for other components:
 *   data-cursor="Label"      label shown in the ring
 *   data-reveal-img="url"    picture that follows the pointer over the row
 *   data-magnetic            element leans towards the pointer
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

const QUERY = "(pointer: fine) and (hover: hover) and (prefers-reduced-motion: no-preference)";
const INTERACTIVE = "a, button, [role='button'], summary, label[for], [data-cursor], [data-reveal-img]";
const MAGNETIC = "[data-magnetic], .btn-primary, .icon-btn, .tl-open, .tl-play, .disc-btn";
const TEXTY = "input:not([type='range']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function CursorLayer() {
  const enabled = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const revealImg = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const r = ring.current!;
    const d = dot.current!;
    const l = label.current!;
    const rv = reveal.current!;
    const ri = revealImg.current!;
    document.documentElement.classList.add("has-cursor");

    const p = { x: -100, y: -100 };
    const rp = { x: -100, y: -100 };
    const vp = { x: -100, y: -100, vx: 0 };
    let magEl: HTMLElement | null = null;
    // Scales are folded into the inline transform. The CSS \`scale\`
    // property applies on top of the translate, so it would scale the
    // pointer position too and throw the ring off across the screen.
    let down = false;
    let hovering = false;
    let labelled = false;
    let ringS = 1;
    let revealOn = false;
    let revealS = 0.85;
    let revealSrc = "";
    let shown = false;
    let raf = 0;

    const setMag = (el: HTMLElement | null) => {
      if (magEl && magEl !== el) magEl.style.translate = "";
      magEl = el;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!shown) {
        shown = true;
        rp.x = vp.x = p.x;
        rp.y = vp.y = p.y;
        r.classList.add("is-shown");
        d.classList.add("is-shown");
      }
      const t = e.target instanceof Element ? e.target : null;
      const texty = t?.closest(TEXTY);
      const hit = texty ? null : (t?.closest(INTERACTIVE) as HTMLElement | null);
      const lab = (t?.closest("[data-cursor]") as HTMLElement | null)?.dataset.cursor ?? "";
      hovering = Boolean(hit);
      labelled = Boolean(lab);
      r.classList.toggle("is-hover", hovering);
      r.classList.toggle("is-text", Boolean(texty));
      r.classList.toggle("is-labelled", labelled);
      l.classList.toggle("is-shown", labelled);
      if (lab && l.textContent !== lab) l.textContent = lab;

      const src = (t?.closest("[data-reveal-img]") as HTMLElement | null)?.dataset.revealImg ?? "";
      if (src !== revealSrc) {
        revealSrc = src;
        if (src) ri.src = src;
        revealOn = Boolean(src);
        rv.classList.toggle("is-shown", revealOn);
      }

      const m = t?.closest(MAGNETIC) as HTMLElement | null;
      setMag(m);
      if (m) {
        const b = m.getBoundingClientRect();
        const dx = p.x - (b.left + b.width / 2);
        const dy = p.y - (b.top + b.height / 2);
        const k = Math.min(0.28, 18 / Math.max(b.width, b.height));
        m.style.translate = `${(dx * k).toFixed(1)}px ${(dy * k).toFixed(1)}px`;
      }
    };
    const onLeave = () => {
      shown = false;
      r.classList.remove("is-shown");
      d.classList.remove("is-shown");
      l.classList.remove("is-shown");
      rv.classList.remove("is-shown");
      revealOn = false;
      revealSrc = "";
      setMag(null);
    };
    const onDown = () => {
      down = true;
    };
    const onUp = () => {
      down = false;
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      rp.x += (p.x - rp.x) * 0.2;
      rp.y += (p.y - rp.y) * 0.2;
      const px = vp.x;
      vp.x += (p.x - vp.x) * 0.12;
      vp.y += (p.y - vp.y) * 0.12;
      vp.vx = vp.vx * 0.8 + (vp.x - px) * 0.2;
      const ringTarget = (hovering ? 1.6 : 1) * (down ? 0.82 : 1);
      ringS += (ringTarget - ringS) * 0.25;
      revealS += ((revealOn ? 1 : 0.85) - revealS) * 0.18;
      d.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      r.style.transform = `translate3d(${rp.x}px, ${rp.y}px, 0) scale(${ringS.toFixed(3)})`;
      l.style.transform = `translate3d(${rp.x + 16}px, ${rp.y + 18}px, 0)`;
      const tilt = Math.max(-12, Math.min(12, vp.vx * 0.6));
      rv.style.transform = `translate3d(${vp.x + 40}px, ${vp.y - 120}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${revealS.toFixed(3)})`;
    };
    raf = requestAnimationFrame(frame);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      cancelAnimationFrame(raf);
      setMag(null);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.classList.remove("has-cursor");
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="cur" aria-hidden="true">
      <div className="cur-reveal" ref={reveal}>
        <img ref={revealImg} alt="" referrerPolicy="no-referrer" decoding="async" />
      </div>
      <div className="cur-ring" ref={ring} />
      <div className="cur-label" ref={label} />
      <div className="cur-dot" ref={dot} />
    </div>
  );
}
