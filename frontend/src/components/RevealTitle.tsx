import { Fragment } from "react";

/**
 * A heading whose words rise in one after another, like a title card.
 * CSS only, so it works in the server render; the text stays one heading for
 * screen readers. The stagger is capped so long titles finish quickly.
 */
export default function RevealTitle({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <h1 className={`${className} reveal-title`}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="rt-w" aria-hidden="true">
            <span style={{ animationDelay: `${120 + Math.min(i, 12) * 45}ms` }}>{w}</span>
          </span>{" "}
        </Fragment>
      ))}
    </h1>
  );
}
