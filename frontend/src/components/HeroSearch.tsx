"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { rememberSearch } from "@/lib/cityPref";

const PROMPTS = [
  "Free tech events this weekend",
  "Beginner-friendly workshops",
  "Startup networking events",
  "Live music near me",
];

/** The home page's plain-words search, set like the destination field on a ticket. Results open on /explore. */
export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = (text: string) => {
    const t = text.trim();
    if (!t) return;
    rememberSearch(t);
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
          Where to?
        </label>
        <div className="hsearch-field">
          <input
            id="hsearch-input"
            className="hsearch-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="AI meetups this weekend"
            enterKeyHint="search"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary hsearch-go">
            <span>Search</span>
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </form>
      <div className="hsearch-try">
        <span className="hsearch-try-label">Try</span>
        <ul>
          {PROMPTS.map((c) => (
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
