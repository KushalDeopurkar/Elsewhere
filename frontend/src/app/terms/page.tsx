import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/Legal";
import SiteFooter from "@/components/SiteFooter";
import { OPERATOR, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use - Elsewhere",
  description: "The rules for using Elsewhere.",
};

export default function TermsPage() {
  return (
    <>
      <div className="shell">
        <LegalPage
          title="Terms of use"
          intro={`By using ${SITE_NAME} you agree to these terms. They're short on purpose.`}
        >
          <h2>What Elsewhere is</h2>
          <p>
            {SITE_NAME} is a free service run by {OPERATOR} that collects event listings so you can find things to do. We
            don&apos;t organise events or sell tickets. When you book, you deal directly with the organiser or ticket
            seller, under their terms.
          </p>

          <h2>Listings can be wrong</h2>
          <p>
            Listings come from other sites and official sources and can be out of date, incomplete or wrong: times,
            prices, venues and whether an event still happens. Always check the details on the organiser&apos;s page before
            you go or pay. We aren&apos;t responsible for events, cancellations, refunds or anything that happens at them.
          </p>

          <h2>Your account</h2>
          <ul>
            <li>Keep your sign-in secure. You&apos;re responsible for what happens on your account.</li>
            <li>Use a username and picture that aren&apos;t offensive and don&apos;t pretend to be someone else.</li>
            <li>You can delete your account at any time in Settings.</li>
          </ul>

          <h2>Fair use</h2>
          <p>Please don&apos;t:</p>
          <ul>
            <li>use {SITE_NAME} to harass, spam or mislead people, including through polls, lists or profiles;</li>
            <li>scrape or copy the site or its data in bulk, or overload it with automated requests;</li>
            <li>try to get into accounts or data that aren&apos;t yours, or break the site&apos;s security.</li>
          </ul>
          <p>We may remove content or suspend accounts that break these rules.</p>

          <h2>Content and credits</h2>
          <p>
            Event names, descriptions and images belong to their organisers and sources, and each listing links back to
            where it came from. Some data is used under open licences, such as the City of Paris&apos;s &ldquo;Que faire à
            Paris&rdquo; agenda under the ODbL. If you own something shown here and want it changed or removed, contact{" "}
            <Contact />.
          </p>

          <h2>No warranty</h2>
          <p>
            {SITE_NAME} is provided as it is, free of charge, without any guarantee that it will be available, accurate or
            fit for a particular purpose. To the extent the law allows, we aren&apos;t liable for losses arising from using
            it. Nothing here limits rights you have under consumer law that can&apos;t be excluded.
          </p>

          <h2>Changes and law</h2>
          <p>
            We may update these terms; if a change matters, we&apos;ll say so on the site first. These terms are governed by
            the laws of India, and the courts of Mumbai have jurisdiction, unless the law where you live says otherwise.
          </p>

          <h2>Contact</h2>
          <p>
            Questions or complaints: <Contact />.
          </p>
        </LegalPage>
      </div>
      <SiteFooter />
    </>
  );
}
