import FlapText from "./FlapText";

/**
 * A full-page notice in the departures-board style (404, errors): a code in
 * big split-flap tiles, a short line saying what happened, and the ways on.
 */
export default function StopNotice({
  code,
  label,
  title,
  children,
  actions,
}: {
  /** Shown in tiles, e.g. "404". */
  code: string;
  /** The board's status word, e.g. "Not on the map". */
  label: string;
  title: string;
  children?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section className="hero-band stop-band">
      <div className="shell stop">
        <div className="stop-board" aria-hidden="true">
          <p className="dep-label">Departures</p>
          <FlapText text={code} length={code.length} className="stop-code" />
          <p className="stop-status">{label}</p>
        </div>
        <div className="stop-copy">
          <h1 className="stop-title">{title}</h1>
          {children && <div className="stop-body">{children}</div>}
          <div className="stop-actions">{actions}</div>
        </div>
      </div>
    </section>
  );
}
