# Saved-event reminders (installable app + push)

People tap **Remind me** on the Saved page and get a notification 2 hours
before each saved event (9 am local on the day for date-only events). No
account needed. iPhones need the site added to the Home Screen first
(iOS 16.4+); the card explains this.

## One-time setup

1. **Run the migration** `supabase/migrations/011_reminders.sql` in the
   Supabase SQL editor (after 010).
2. **Make VAPID keys** (once, keep the private key secret):
   ```
   npx web-push generate-vapid-keys
   ```
3. **Vercel → Settings → Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the public key
   - `VAPID_PRIVATE_KEY` = the private key
   - optional `VAPID_SUBJECT` = `mailto:you@example.com` (defaults to the contact email)

   Redeploy (the public key is baked in at build time).
4. The **Send reminders** GitHub Action calls `/api/reminders/run` every 15
   minutes. It uses the repo variable `SITE_URL` if set, else
   elsewhere-in.vercel.app. Nothing else to add. Run it once by hand from the
   Actions tab to check: `{"sent":0,"failed":0,"gone":0}` means it works.

Without the keys the Remind me card stays hidden and the Action exits quietly.

## How it works

- `public/sw.js`: service worker, push + notification click only (no caching).
- `lib/reminders.ts`: when a reminder goes out and what it says (tested).
- `lib/push.ts`: subscribe, keep the server list in step with saves.
- `api/reminders`: PUT sync, DELETE off, PATCH address rotation.
- `api/reminders/run`: claims due reminders (so runs never double-send),
  sends them, forgets devices the push service says are gone (404/410).
- Only known push services (Google, Mozilla, Apple, Microsoft) are contacted.
