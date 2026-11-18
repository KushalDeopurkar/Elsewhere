"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight, DownloadSimple, Pause, Play, ShareNetwork, X } from "@phosphor-icons/react/ssr";
import CategoryIcon from "./CategoryIcon";
import CategoryWorld from "./CategoryWorld";
import { useSaved } from "@/lib/saved";
import { usePassport } from "@/lib/passport";
import { tasteSummary, useTaste } from "@/lib/taste";
import { useStreak } from "@/lib/streak";
import { useNow } from "@/lib/clock";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { buildRecap } from "@/lib/recap";
import { CATEGORIES, type EventCategory } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { sfx } from "@/lib/sound";

const SLIDE_MS = 5500;
const labelOf = (c: EventCategory) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/**
 * "Your month in Elsewhere": a short full-screen recap from your own
 * activity, ending in a story-sized image to share. Tap the sides or use
 * the arrow keys; it advances on its own unless paused (or reduced motion).
 */
export default function RecapView() {
  const router = useRouter();
  const saved = useSaved();
  const passport = usePassport();
  const taste = useTaste();
  const streak = useStreak();
  const now = useNow(60_000);
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [going, setGoing] = useState<number | null>(null);

  // How many events you marked Going this month (signed in only).
  useEffect(() => {
    const sb = supabase();
    if (!sb || !uid || !now) return;
    const start = new Date(now);
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    let live = true;
    void sb
      .from("attendance")
      .select("event_id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("status", "going")
      .gte("created_at", start.toISOString())
      .then(({ count }) => live && setGoing(count ?? 0));
    return () => {
      live = false;
    };
  }, [uid, now]);

  const recap = useMemo(
    () =>
      now
        ? buildRecap({
            now,
            saved: saved.map((s) => ({ savedAt: s.savedAt, category: s.event.category })),
            passport,
            topCategories: tasteSummary(taste).cats,
            streak,
            going,
            labelOf,
          })
        : null,
    [now, saved, passport, taste, streak, going],
  );

  const slides = useMemo(() => {
    if (!recap) return [];
    const s: string[] = ["intro"];
    if (recap.saved) s.push("saved");
    if (recap.top) s.push("top");
    if (recap.stamps.length) s.push("stamps");
    if (recap.nights || recap.early || recap.free || recap.streak > 1 || recap.going) s.push("habits");
    s.push("persona");
    return s;
  }, [recap]);

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const last = slides.length - 1;
  const go = useCallback(
    (d: number) => {
      setI((x) => Math.max(0, Math.min(last, x + d)));
      sfx("tick");
    },
    [last],
  );
  const close = useCallback(() => (window.history.length > 1 ? router.back() : router.push("/passport")), [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, close]);

  if (!recap) return <div className="rc" aria-busy="true" />;

  if (recap.empty) {
    return (
      <div className="rc is-empty">
        <div className="rc-slide is-on">
          <p className="rc-kicker">Your {recap.month} in Elsewhere</p>
          <h1 className="rc-big">Nothing to recap yet</h1>
          <p className="rc-line">Save, swipe or mark events Going this month and your recap builds itself.</p>
          <div className="rc-actions">
            <Link href="/discover" className="btn btn-primary">Start swiping</Link>
            <Link href="/" className="btn btn-ghost">Back home</Link>
          </div>
        </div>
      </div>
    );
  }

  const current = slides[Math.min(i, last)];
  const hue = recap.top ? getCategoryColor(recap.top.value).color : undefined;
  const shareSrc = `/api/recap?${new URLSearchParams({
    month: recap.month,
    persona: recap.persona.title,
    line: recap.persona.line,
    top: recap.top?.label ?? "",
    saved: String(recap.saved),
    stamps: String(recap.stamps.length),
    going: String(recap.going ?? 0),
    nights: String(recap.nights),
  })}`;

  const share = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(shareSrc)).blob();
      const file = new File([blob], `elsewhere-${recap.monthKey}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `My ${recap.month} in Elsewhere` });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } catch {
      /* cancelled */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rc" style={{ "--cat-hue": hue } as React.CSSProperties} role="region" aria-roledescription="slideshow" aria-label={`Your ${recap.month} in Elsewhere`}>
      <div className="rc-top">
        <div className="rc-bars" aria-hidden="true">
          {slides.map((s, k) => (
            <span key={s} className="rc-bar">
              <span
                key={k === i ? `on-${i}` : s}
                className={`rc-fill${k < i ? " is-done" : k === i && k < last ? " is-on" : k === i ? " is-done" : ""}${paused ? " is-paused" : ""}`}
                style={k === i && k < last ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
                onAnimationEnd={k === i ? () => go(1) : undefined}
              />
            </span>
          ))}
        </div>
        <div className="rc-head">
          <span>
            {i + 1}/{slides.length}
          </span>
          <button type="button" className="icon-btn" aria-label={paused ? "Play" : "Pause"} aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? <Play size={16} weight="fill" /> : <Pause size={16} weight="fill" />}
          </button>
          <button type="button" className="icon-btn" aria-label="Close recap" onClick={close}>
            <X size={18} weight="bold" />
          </button>
        </div>
      </div>

      <button type="button" className="rc-nav is-prev" aria-label="Previous" onClick={() => go(-1)} disabled={i === 0}>
        <CaretLeft size={20} weight="bold" />
      </button>
      <button type="button" className="rc-nav is-next" aria-label="Next" onClick={() => go(1)} disabled={i === last}>
        <CaretRight size={20} weight="bold" />
      </button>

      <div className="rc-stage" key={current} aria-live="polite">
        {current === "intro" && (
          <div className="rc-slide is-on">
            <p className="rc-kicker">Elsewhere recap</p>
            <h1 className="rc-big">
              Your <em>{recap.month}</em>, replayed.
            </h1>
            <p className="rc-line">A look back at what you went looking for.</p>
          </div>
        )}
        {current === "saved" && (
          <div className="rc-slide is-on">
            <p className="rc-kicker">You saved</p>
            <p className="rc-num">{recap.saved}</p>
            <p className="rc-line">{recap.saved === 1 ? "event" : "events"} worth showing up for.</p>
          </div>
        )}
        {current === "top" && recap.top && (
          <div className="rc-slide is-on is-world">
            <CategoryWorld category={recap.top.value} />
            <p className="rc-kicker">Your top vibe</p>
            <p className="rc-big rc-cat">
              <CategoryIcon category={recap.top.value} size={56} weight="fill" /> {recap.top.label}
            </p>
          </div>
        )}
        {current === "stamps" && (
          <div className="rc-slide is-on">
            <p className="rc-kicker">New passport stamps</p>
            <ul className="rc-stamps">
              {recap.stamps.map((s, k) => (
                <li key={s.value} style={{ "--cat-hue": getCategoryColor(s.value).color, animationDelay: `${200 + k * 160}ms` } as React.CSSProperties}>
                  <CategoryIcon category={s.value} size={30} weight="fill" />
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {current === "habits" && (
          <div className="rc-slide is-on">
            <p className="rc-kicker">How you went out</p>
            <dl className="rc-stats">
              {recap.going ? <div><dt>marked Going</dt><dd>{recap.going}</dd></div> : null}
              {recap.nights ? <div><dt>after 9 pm</dt><dd>{recap.nights}</dd></div> : null}
              {recap.early ? <div><dt>before 9 am</dt><dd>{recap.early}</dd></div> : null}
              {recap.free ? <div><dt>free events</dt><dd>{recap.free}</dd></div> : null}
              {recap.streak > 1 ? <div><dt>day streak</dt><dd>{recap.streak}</dd></div> : null}
            </dl>
            {recap.cities.length > 1 && <p className="rc-line">Across {recap.cities.join(", ")}.</p>}
          </div>
        )}
        {current === "persona" && (
          <div className="rc-slide is-on">
            <p className="rc-kicker">Your {recap.month} on Elsewhere</p>
            <h2 className="rc-big rc-persona">{recap.persona.title}</h2>
            <p className="rc-line">{recap.persona.line}</p>
            <div className="rc-actions">
              <button type="button" className="btn btn-primary" onClick={share} disabled={busy}>
                <ShareNetwork size={17} weight="bold" aria-hidden="true" /> {busy ? "Preparing…" : "Share my recap"}
              </button>
              <a className="btn btn-ghost" href={shareSrc} download={`elsewhere-${recap.monthKey}.png`}>
                <DownloadSimple size={17} weight="bold" aria-hidden="true" /> Save image
              </a>
            </div>
            <Link href="/" className="rc-more">Find what&apos;s next →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
