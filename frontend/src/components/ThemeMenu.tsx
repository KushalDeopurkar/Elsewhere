"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleHalf, Moon, Sparkle, Sun } from "@phosphor-icons/react/ssr";
import { setThemePref, useThemePref } from "./ThemeSync";
import type { ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "auto", label: "Follow the sun", icon: CircleHalf },
  { value: "day", label: "Day", icon: Sun },
  { value: "night", label: "Night", icon: Moon },
  { value: "vivid", label: "Vivid", icon: Sparkle },
];

/**
 * The display switch in the header: the same four choices as Settings, one
 * tap away. A small menu of radio buttons; Escape or a click outside closes it.
 */
export default function ThemeMenu() {
  const pref = useThemePref();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const current = OPTIONS.find((o) => o.value === pref) ?? OPTIONS[0];
  const Icon = current.icon;

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const picked = e.key === "Enter" && wrap.current?.contains(e.target as Node) && e.target !== button.current;
      if (e.key === "Escape" || picked) {
        // Focus returns to the button during this key press; without this the
        // same Enter would then click the button and reopen the menu.
        e.preventDefault();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="theme-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={`icon-btn theme-btn is-${pref}`}
        aria-label={`Display: ${current.label}. Change`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon size={18} weight={pref === "vivid" ? "fill" : "bold"} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="theme-pop" role="radiogroup" aria-label="Display">
          {OPTIONS.map(({ value, label, icon: OptIcon }) => (
            <label key={value} className={`theme-opt is-${value}${pref === value ? " is-on" : ""}`}>
              <input
                type="radio"
                name={`${id}-theme`}
                value={value}
                checked={pref === value}
                onChange={() => setThemePref(value)}
                onClick={(e) => {
                  // A pointer pick closes the menu; arrow keys only move the choice.
                  if (e.detail > 0) setOpen(false);
                }}
              />
              <OptIcon size={16} weight={value === "vivid" ? "fill" : "bold"} aria-hidden="true" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
