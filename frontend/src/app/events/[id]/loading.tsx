"use client";

/**
 * Event page loading state. If the visitor came from an event card we
 * already have its picture and title, so show them straight away in the
 * page's real layout; the rest streams in when the server answers.
 */
import { useParams } from "next/navigation";
import EventImage from "@/components/EventImage";
import { getPreview } from "@/lib/eventPreview";
import { CATEGORIES } from "@/lib/types";

export default function LoadingEvent() {
  const { id } = useParams<{ id: string }>();
  const p = getPreview(id);
  const label = p ? CATEGORIES.find((c) => c.value === p.category)?.label : null;
  return (
    <article className="detail is-loading" aria-busy="true" aria-label="Loading event">
      <div className="shell detail-top">
        <span className="skel skel-crumbs" />
      </div>
      <div className="shell detail-stage">
        <div className="detail-media is-trailer">
          {p ? (
            <EventImage src={p.image_url} alt="" category={p.category} ratio="21 / 9" priority width={1100} />
          ) : (
            <div className="skel detail-media-skel" />
          )}
        </div>
      </div>
      <div className="shell detail-grid">
        <div className="detail-main">
          <header className="detail-head">
            {label ? <p className="detail-kicker">{label}{p?.city ? <span> · {p.city}</span> : null}</p> : <span className="skel skel-line" />}
            {p ? <h1 className="detail-title">{p.title}</h1> : <span className="skel skel-title" />}
            <span className="skel skel-line" />
          </header>
        </div>
        <aside className="skel skel-aside" aria-hidden="true" />
      </div>
    </article>
  );
}
