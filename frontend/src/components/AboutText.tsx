"use client";

import { useState } from "react";

/** Full event description in paragraphs, folded after a few if it is long. */
export default function AboutText({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const long = text.length > 700 && paras.length > 3;
  const [open, setOpen] = useState(!long);
  const shown = open ? paras : paras.slice(0, 3);
  return (
    <div className="about">
      {shown.map((p, i) => (
        <p key={i} className="prose about-p">
          {p.split("\n").map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
      {long && (
        <button type="button" className="about-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : `Read more (${paras.length - 3} more paragraph${paras.length - 3 === 1 ? "" : "s"})`}
        </button>
      )}
    </div>
  );
}
