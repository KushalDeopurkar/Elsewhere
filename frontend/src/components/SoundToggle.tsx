"use client";

import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react/ssr";
import { setSound, useSoundOn } from "@/lib/sound";

/** The one switch for sound. Off until someone turns it on. */
export default function SoundToggle() {
  const on = useSoundOn();
  return (
    <button
      type="button"
      className="icon-btn sound-toggle"
      aria-pressed={on}
      aria-label={on ? "Turn sound and haptics off" : "Turn sound and haptics on"}
      title={on ? "Sound on" : "Sound off"}
      onClick={() => setSound(!on)}
    >
      {on ? <SpeakerHigh size={18} weight="bold" /> : <SpeakerSlash size={18} weight="bold" />}
    </button>
  );
}
