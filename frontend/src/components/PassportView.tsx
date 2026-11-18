"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Fire, MapPin, FilmSlate } from "@phosphor-icons/react/ssr";
import CategoryIcon from "./CategoryIcon";
import { CATEGORIES } from "@/lib/types";
import { getCategoryColor } from "@/lib/categoryColors";
import { categoryHref } from "@/lib/categoryPages";
import { badges, resetPassport, usePassport } from "@/lib/passport";
import { useStreak } from "@/lib/streak";

// Stamps you've already seen land here without the slam.
const SEEN_KEY = "ee.pp.seen.v1";
const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

const DATE = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

/**
 * Stamps for each category explored (open or save an event), the cities
 * looked at, and badges with progress. Nothing here is shared or synced.
 */
export default function PassportView() {
  const p = usePassport();
  const streak = useStreak();
  const list = badges(p, streak);
  const cats = CATEGORIES.filter((c) => c.value !== "other");
  const got = cats.filter((c) => p.cats[c.value]).length;
  const cities = Object.keys(p.cities);
  const earned = list.filter((b) => b.earned).length;

  // New stamps since your last visit get stamped onto the page; then they
  // count as seen. (Deferred a tick so the first paint matches the server.)
  const gotKey = cats.filter((c) => p.cats[c.value]).map((c) => c.value).join(",");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!gotKey) return;
    const have = gotKey.split(",");
    const seen = new Set(readSeen());
    const t = window.setTimeout(() => {
      const next = new Set(have.filter((v) => !seen.has(v)));
      if (next.size) setFresh(next);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(have));
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [gotKey]);
  let freshIndex = 0;

  return (
    <div className="passport">
      <Link href="/recap" className="pp-recap">
        <FilmSlate size={22} weight="duotone" aria-hidden="true" />
        <span>
          <strong>Your month in Elsewhere</strong>
          <small>A one-minute replay of what you explored. Shareable.</small>
        </span>
        <span className="pp-recap-go" aria-hidden="true">Play →</span>
      </Link>

      <div className="pp-stats">
        <p><strong>{got}</strong>/{cats.length} stamps</p>
        <p><strong>{earned}</strong>/{list.length} badges</p>
        <p><strong>{Object.keys(p.venues).length}</strong> venues</p>
        <p><Fire size={18} weight="fill" aria-hidden="true" /> <strong>{streak}</strong> day streak</p>
      </div>

      <section className="pp-sec" aria-labelledby="pp-stamps">
        <h2 id="pp-stamps" className="pp-h2">Stamps</h2>
        <ul className="pp-stamps">
          {cats.map((c, i) => {
            const at = p.cats[c.value];
            const hue = getCategoryColor(c.value);
            return (
              <li key={c.value}>
                <Link
                  href={categoryHref(c.value)}
                  className={`pp-stamp${at ? " is-got" : ""}${fresh.has(c.value) ? " is-fresh" : ""}`}
                  style={
                    {
                      "--cat-hue": hue.color,
                      "--cat-wash": hue.wash,
                      "--tilt": `${((i * 37) % 11) - 5}deg`,
                      "--d": fresh.has(c.value) ? `${250 + freshIndex++ * 220}ms` : "0ms",
                    } as React.CSSProperties
                  }
                  aria-label={`${c.label}: ${at ? `stamped ${DATE.format(new Date(at))}` : "not stamped yet"}`}
                >
                  <span className="pp-ring">
                    <CategoryIcon category={c.value} size={26} weight={at ? "fill" : "regular"} />
                  </span>
                  <span className="pp-name">{c.label}</span>
                  <span className="pp-date">{at ? DATE.format(new Date(at)) : "Not yet"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="pp-sec" aria-labelledby="pp-badges">
        <h2 id="pp-badges" className="pp-h2">Badges</h2>
        <ul className="pp-badges">
          {list.map((b) => (
            <li key={b.id} className={`pp-badge${b.earned ? " is-earned" : ""}`}>
              <span className="pp-badge-mark" aria-hidden="true">
                {b.earned ? <Check size={18} weight="bold" /> : `${b.have}/${b.need}`}
              </span>
              <span className="pp-badge-text">
                <strong>{b.title}</strong>
                <small>{b.desc}</small>
                <span className="pp-bar" aria-hidden="true">
                  <span style={{ transform: `scaleX(${b.have / b.need})` }} />
                </span>
              </span>
              <span className="sr-only">{b.earned ? "Earned" : `${b.have} of ${b.need}`}</span>
            </li>
          ))}
        </ul>
      </section>

      {cities.length > 0 && (
        <section className="pp-sec" aria-labelledby="pp-cities">
          <h2 id="pp-cities" className="pp-h2">Cities</h2>
          <ul className="pp-cities">
            {cities.map((c) => (
              <li key={c}><MapPin size={14} weight="fill" aria-hidden="true" /> {c}</li>
            ))}
          </ul>
        </section>
      )}

      {got === 0 && (
        <p className="pp-empty">
          Open or save any event to collect your first stamp. <Link href="/discover" className="sec-link">Start swiping</Link>
        </p>
      )}
      {got > 0 && (
        <button type="button" className="disc-link pp-reset" onClick={() => window.confirm("Clear every stamp and badge?") && resetPassport()}>
          Reset passport
        </button>
      )}
    </div>
  );
}
