import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/Legal";
import SiteFooter from "@/components/SiteFooter";
import { OPERATOR, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy - Elsewhere",
  description: "What Elsewhere collects, why, who it's shared with, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <>
      <div className="shell">
        <LegalPage
          title="Privacy policy"
          intro={`${SITE_NAME} helps you find events and go with friends. You can browse without an account. This page explains what we keep when you do more than browse, why, and how to get it deleted.`}
        >
          <h2>Who we are</h2>
          <p>
            {SITE_NAME} is run by {OPERATOR}, an individual developer based in India. For anything about your data,
            contact <Contact />.
          </p>

          <h2>What stays on your device only</h2>
          <p>
            Without an account, your saved events, chosen city, recent searches, passport stamps, places you set for travel
            times and your name for poll votes are kept in your browser&apos;s local storage. They never reach our servers.
            Clearing your browser data removes them. We don&apos;t use advertising or tracking cookies.
          </p>

          <h2>What we collect when you sign in</h2>
          <ul>
            <li>
              <strong>Account:</strong> your email address, and if you use Google, your name and profile picture from
              Google. Sign-in is handled by Supabase; we never see your Google password.
            </li>
            <li>
              <strong>Profile:</strong> the username, display name, bio, city and picture you choose.
            </li>
            <li>
              <strong>Social activity:</strong> who you follow, events you mark Going or Interested, saved events, lists,
              passport stamps and polls you start.
            </li>
          </ul>
          <p>
            By default, what you&apos;re going to, your passport and lists marked Friends are visible only to friends
            (people you follow who follow you back). Your name, @username and picture are always visible so people can
            find you. You can make your profile public in Settings.
          </p>

          <h2>Polls</h2>
          <p>
            Anyone with a poll&apos;s link can see the poll, the events in it and the names of the people who voted. If
            you vote without an account, we store the name you type and a random code from your browser (so you can change
            your vote). Don&apos;t put anything in a name you wouldn&apos;t want the group to see.
          </p>

          <h2>Alerts</h2>
          <p>
            If you turn on an alert for a search, we keep the search and where to send it: your email address (after you
            confirm it) or your Telegram chat. Every alert has an unsubscribe link, which deletes it.
          </p>

          <h2>Location and travel times</h2>
          <p>
            If you ask for travel time to an event and allow location, your browser&apos;s location is sent to our server
            to work out the route, along with the event&apos;s location. We pass those two points to a routing service
            (Google Maps Platform, TomTom, or the free OpenStreetMap router at routing.openstreetmap.de) and
            don&apos;t store them. Addresses you type to set a starting point are
            looked up with Photon (komoot), a geocoding service built on OpenStreetMap.
          </p>

          <h2>Search and Plan My Day</h2>
          <p>
            Search text is turned into a numerical summary (an embedding) on our database host, Supabase, to find
            similar events. What you type into Plan My Day is sent to an AI model (Groq, or Google Gemini as a fallback)
            to understand the request. Don&apos;t include personal details there.
          </p>

          <h2>Usage statistics and error reports</h2>
          <p>
            We count page views and a few actions (such as saving an event, starting or voting in a poll, or changing
            city) with Vercel Web Analytics, and measure how fast pages load with Vercel Speed Insights. Neither uses
            cookies or stores anything on your device, and the counts don&apos;t identify you: no names, emails or what
            you typed. If the site crashes in your browser, an error report (the error, the page and your browser type)
            may be sent to Sentry so we can fix it, without your name, email, cookies or form contents.
          </p>

          <h2>Who processes data for us</h2>
          <ul>
            <li>Supabase: database, sign-in and search (servers may be outside India).</li>
            <li>Vercel: hosts the website and counts visits (Web Analytics, Speed Insights). Render: hosts the events API.</li>
            <li>Sentry: error reports, if enabled.</li>
            <li>Google: sign-in (if you choose it), Gemini and route times.</li>
            <li>Groq, TomTom, the OpenStreetMap router and Photon (komoot): as described above.</li>
            <li>Brevo: sends alert emails. Telegram: delivers Telegram alerts.</li>
            <li>OpenFreeMap and CARTO: serve the map tiles your browser loads, and so see your IP address.</li>
          </ul>
          <p>We don&apos;t sell your data or share it with advertisers.</p>

          <h2>Event listings</h2>
          <p>
            Events come from public listings and official sources (for example Ticketmaster, SeatGeek, Eventfinda, the
            City of Paris open data, District and others). Buying a ticket happens on the organiser&apos;s or ticket
            seller&apos;s site, under their own privacy policy, not ours.
          </p>

          <h2>How long we keep it, and deleting it</h2>
          <p>
            We keep your account data until you delete your account. You can delete it at any time in{" "}
            <a href="/settings">Settings</a> under &ldquo;Delete account&rdquo;: that removes your profile, follows, plans,
            saved events, lists, passport and polls straight away. Guest poll votes stay with the poll; ask us to remove
            one. Server logs kept by our hosts are deleted on their own schedules.
          </p>

          <h2>Your rights</h2>
          <p>
            Depending on where you live (including under India&apos;s Digital Personal Data Protection Act and the EU and
            UK GDPR), you can ask to see, correct, export or delete your data, or object to how it&apos;s used. Most of
            this you can do yourself in Settings; for anything else contact <Contact />. You can also complain to your
            local data protection authority.
          </p>

          <h2>Children</h2>
          <p>
            {SITE_NAME} isn&apos;t meant for children. Don&apos;t create an account if you&apos;re under 18 without a
            parent&apos;s or guardian&apos;s permission.
          </p>

          <h2>Changes</h2>
          <p>If this policy changes in a way that matters, we&apos;ll say so on the site before it takes effect.</p>
        </LegalPage>
      </div>
      <SiteFooter />
    </>
  );
}
