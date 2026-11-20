import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Alerts · Elsewhere",
  description: "Get new matches for any search by email or Telegram.",
};

/** What alerts are and how to make one. Alerts live with your email or Telegram, so there is no list to manage here. */
export default function AlertsPage() {
  return (
    <>
      <section className="shell section alerts-help">
        <p className="sec-kicker">Alerts</p>
        <h1 className="page-title">New matches, sent to you</h1>
        <p className="lede">
          Any search on Explore can become an alert. When new events match it, Elsewhere sends them by email or on
          Telegram, at most once a day.
        </p>
        <ol className="alerts-steps">
          <li>
            <b>Search for what you want</b> on Explore, in plain words: &ldquo;free AI workshops&rdquo;, &ldquo;live
            music under ₹500&rdquo;.
          </li>
          <li>
            <b>Choose &ldquo;Email me&rdquo; or &ldquo;Alert me on Telegram&rdquo;</b> above the results.
          </li>
          <li>
            <b>Confirm</b> from the email or the Telegram chat. Every alert has a link to stop it, any time.
          </li>
        </ol>
        <Link href="/explore" className="btn btn-primary">
          Make an alert on Explore
        </Link>
      </section>
      <SiteFooter />
    </>
  );
}
