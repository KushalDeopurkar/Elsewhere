export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell footer-inner">
        <span className="wordmark" aria-hidden="true">
          EventEngine<span className="wordmark-dot">.</span>
        </span>
        <p className="footer-note">
          Events are gathered from public listings and refreshed on a schedule,
          so coverage varies by city and category. Saved events are stored in
          this browser only.
        </p>
      </div>
    </footer>
  );
}
