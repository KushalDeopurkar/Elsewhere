"use client";

import { usePathname } from "next/navigation";
import { X } from "@phosphor-icons/react/ssr";
import { setGrade, useGrade } from "@/lib/grade";
import { VIBES } from "@/lib/vibe";

/** Shows which vibe is colouring the site, with one tap to go back to normal. */
export default function GradeChip() {
  const grade = useGrade();
  const pathname = usePathname();
  if (!grade || pathname === "/vibe") return null;
  const label = VIBES.find((v) => v.id === grade)?.label ?? grade;
  return (
    <button type="button" className="grade-chip" onClick={() => setGrade(null)} aria-label={`Vibe colours: ${label}. Reset to normal colours`}>
      <span className="grade-dot" aria-hidden="true" />
      {label} vibe
      <X size={13} weight="bold" aria-hidden="true" />
    </button>
  );
}
