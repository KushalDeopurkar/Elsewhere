"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, Sparkle, ArrowRight } from "@phosphor-icons/react/ssr";
import { rememberSearch } from "@/lib/cityPref";

const CHIPS = [
  "Free tech events this weekend",
  "Beginner-friendly workshops",
  "Startup networking events",
  "Live music near me",
];

/** The homepage's natural-language search. Results open on /explore. */
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
        <Sparkle size={20} weight="fill" className="hsearch-ai" aria-hidden="true" />
        <input
          className="hsearch-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try ‘Find AI meetups this weekend near me’…"
          aria-label="Describe what you want to do"
          enterKeyHint="search"
        />
        <button type="submit" className="btn btn-primary hsearch-go">
          <MagnifyingGlass size={17} weight="bold" />
          <span>Search</span>
        </button>
      </form>
      <div className="hsearch-chips">
        {CHIPS.map((c) => (
          <button key={c} type="button" className="chip-prompt" onClick={() => go(c)}>
            {c} <ArrowRight size={12} weight="bold" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
