import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/site";

/** Shared frame for the privacy policy and terms. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <article className="legal">
      <p className="sec-kicker">Last updated {LEGAL_UPDATED}</p>
      <h1>{title}</h1>
      <p className="legal-intro">{intro}</p>
      {children}
      <nav className="legal-other" aria-label="Legal">
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms of use</Link>
      </nav>
    </article>
  );
}

export function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <Link href="/settings">your account settings</Link>
  );
}
