import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="foot">
      <div className="shell foot-inner">
        <span>Elsewhere, a universal event discovery engine.</span>
        <span>Listings aggregated from public sources.</span>
        <nav className="foot-legal" aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
