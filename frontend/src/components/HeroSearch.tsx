"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { useCity } from "@/lib/cityPref";
import { cityCountry } from "@/lib/cities";
import { homePrompts } from "@/lib/intent";
import { cheapIn } from "@/lib/money";

/**
 * The home page's plain-words search: Elsewhere reads the request (what,
 * when, budget, where, online or not) and Explore shows what it understood
 * and why each result matches.
 */
export default function HeroSearch() {
  const router = useRouter();
  const city = useCity();
  const [q, setQ] = useState("");
  // One prompt per kind of plan, priced in the city's money; each is tested
  // to return real matches (lib/intent.test.ts).
  const prompts = homePrompts(cheapIn(cityCountry(city)));

  // Explore remembers the search once it has results (junk isn't kept).
  const go = (text: string) => {
    const t = text.trim();
    if (!t) return;
    router.push(`/explore?q=${encodeURIComponent(t)}`);
  };

  return (
    <div className="hsearch">
      <form
        className="hsearch-box"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <label className="hsearch-label" htmlFor="hsearch-input">
          Ask Elsewhere
        </label>
        <div className="hsearch-field">
          <input
            id="hsearch-input"
            className="hsearch-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask in plain words"
            enterKeyHint="search"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary hsearch-go">
            <span>Search</span>
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </form>
      <p className="hsearch-help">Say what, when, how much and where, in your own words. It reads the request and shows why each event matches.</p>
      <div className="hsearch-try">
        <span className="hsearch-try-label">Try</span>
        <ul>
          {prompts.map((c) => (
            <li key={c}>
              <button type="button" className="hsearch-prompt" onClick={() => go(c)}>
                {c}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
