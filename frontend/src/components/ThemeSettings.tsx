"use client";

import { setThemePref, useTheme, useThemePref } from "./ThemeSync";
import type { ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; note: string }[] = [
  { value: "auto", label: "Follow the sun", note: "Day timetable until 18:00 in your city, the lit board after." },
  { value: "day", label: "Always day", note: "White paper and ink." },
  { value: "night", label: "Always night", note: "The lit departure board." },
  { value: "vivid", label: "Vivid", note: "The city as a transit map at night: charcoal, with every kind of event on its own coloured line." },
];

/** Day or night: the one display setting, kept on this device. */
export default function ThemeSettings() {
  const pref = useThemePref();
  const theme = useTheme();
  return (
    <fieldset className="st-theme">
      <legend className="st-legend">Display</legend>
      <div className="st-options" role="radiogroup" aria-label="Display">
        {OPTIONS.map((o) => (
          <label key={o.value} className={`st-option${pref === o.value ? " is-on" : ""}`}>
            <input
              type="radio"
              name="theme"
              value={o.value}
              checked={pref === o.value}
              onChange={() => setThemePref(o.value)}
            />
            <span className={`st-swatch is-${o.value}`} aria-hidden="true" />
            <span className="st-option-text">
              <span className="st-option-label">{o.label}</span>
              <span className="st-option-note">{o.note}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="st-now" aria-live="polite">
        {theme
          ? `Showing ${pref === "vivid" ? "the vivid night" : theme === "night" ? "the night board" : "the day timetable"} now.`
          : " "}
      </p>
    </fieldset>
  );
}
