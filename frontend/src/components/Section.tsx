import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import PosterRail from "./PosterRail";
import type { EventCategory } from "@/lib/types";

/** Line colours for numbered sections, in order: red, yellow, green, blue, violet, pink. */
const LINE_HUES = [30, 85, 150, 235, 300, 350];

/** Section heading with an optional "see all" link. */
export function SectionHeader({
  title,
  kicker,
  index,
  href,
  linkLabel = "See all",
  children,
}: {
  title: string;
  kicker?: React.ReactNode;
  /** Section number on the timetable, "01". */
  index?: string;
  href?: string;
  linkLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sec-head">
      {index && (
        <span
          className="sec-index"
          aria-hidden="true"
          // Each numbered section sits on its own line colour (Vivid shows it as a roundel).
          style={{ "--sec-line": `oklch(var(--cat-l) var(--cat-c) ${LINE_HUES[(Number(index) - 1 + LINE_HUES.length) % LINE_HUES.length] ?? 30})` } as React.CSSProperties}
        >
          {index}
        </span>
      )}
      <div className="sec-head-text">
        {kicker && <p className="sec-kicker">{kicker}</p>}
        <h2 className="sec-title">{title}</h2>
      </div>
      <div className="sec-head-end">
        {children}
        {href && (
          <Link href={href} className="sec-link">
            {linkLabel} <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <ol>
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`}>
            {it.href && i < items.length - 1 ? (
              <Link href={it.href}>{it.label}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined}>{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Each page sits on its own line of the network, like a section does. */
export const PAGE_LINES = {
  explore: 235,
  saved: 350,
  passport: 150,
  settings: 195,
  friends: 300,
  plan: 30,
  alerts: 60,
  me: 300,
} as const;

/** A page's line colour from a hue, at the theme's line lightness. */
export const lineColor = (hue: number) => `oklch(var(--cat-l) var(--cat-c) ${hue})`;

/**
 * Title block at the top of every inner page. With `line` it is a band on
 * that line's colour: a tinted field, the line itself across the top with
 * its stations, and (with `posters`) the next real events in the city on
 * the right, so no page opens on an empty field.
 */
export function PageHeader({
  title,
  lede,
  crumbs,
  children,
  line,
  posters = false,
  category,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  crumbs?: { label: string; href?: string }[];
  children?: React.ReactNode;
  /** The page's line colour (any CSS colour). */
  line?: string;
  /** Show the next events with pictures beside the title. */
  posters?: boolean;
  category?: EventCategory;
}) {
  return (
    <header
      className={`page-head${line ? " is-band" : ""}`}
      style={line ? ({ "--band": line } as React.CSSProperties) : undefined}
    >
      {line && (
        <span className="band-stops" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <div className={`shell${posters ? " page-head-grid" : ""}`}>
        <div className="page-head-text">
          {crumbs && <Breadcrumbs items={crumbs} />}
          <h1 className="page-title">{title}</h1>
          {lede && <p className="page-lede">{lede}</p>}
          {children}
        </div>
        {posters && <PosterRail category={category} />}
      </div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {body && <p className="empty-body">{body}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

export function CardSkeleton({ variant = "standard" }: { variant?: "standard" | "list" | "featured" }) {
  return (
    <div className={`skel skel-${variant}`} aria-hidden="true">
      <div className="skel-media" />
      <div className="skel-lines">
        <span style={{ width: "30%" }} />
        <span style={{ width: "86%" }} />
        <span style={{ width: "58%" }} />
      </div>
    </div>
  );
}
