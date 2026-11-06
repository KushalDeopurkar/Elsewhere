import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";

/** Section heading with an optional "see all" link. */
export function SectionHeader({
  title,
  kicker,
  href,
  linkLabel = "See all",
  children,
}: {
  title: string;
  kicker?: React.ReactNode;
  href?: string;
  linkLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sec-head">
      <div>
        {kicker && <p className="sec-kicker">{kicker}</p>}
        <h2 className="sec-title">{title}</h2>
      </div>
      <div className="sec-head-end">
        {children}
        {href && (
          <Link href={href} className="sec-link">
            {linkLabel} <ArrowRight size={14} weight="bold" />
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

/** Title block at the top of every inner page. */
export function PageHeader({
  title,
  lede,
  crumbs,
  children,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  crumbs?: { label: string; href?: string }[];
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="shell">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
        {children}
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
