# Social layer: one-time setup

Accounts, profiles, friends, Going/Interested and lists run on Supabase Auth
and row level security. The site works without this; social buttons stay
hidden until step 5 is done.

## 1. Run the migration
Supabase dashboard > SQL Editor > paste `supabase/migrations/009_social.sql` > Run.
It is safe to run twice.

## 2. Allowed redirect URLs
Authentication > URL Configuration
- Site URL: `https://elsewhere-in.vercel.app`
- Redirect URLs: add
  - `https://elsewhere-in.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

## 3. Google sign-in
1. Google Cloud Console > APIs & Services > Credentials > Create credentials >
   OAuth client ID > Web application.
2. Authorized redirect URI: `https://gdfhdcjfnrbbtwsfoxea.supabase.co/auth/v1/callback`
3. OAuth consent screen: app name "Elsewhere", your email, publish it.
4. Supabase > Authentication > Sign In / Providers > Google: enable, paste the
   Client ID and Client secret.

## 4. Email links (recommended: send through Brevo)
Email sign-in is on by default, but Supabase's built-in mailer only sends a
few emails an hour. You already use Brevo for alerts:
Supabase > Authentication > Emails > SMTP Settings > enable custom SMTP
- Host `smtp-relay.brevo.com`, port `587`
- Username: your Brevo SMTP login; password: a Brevo SMTP key
- Sender: the same verified sender as ALERT_EMAIL_FROM

## 5. Public key on Vercel
Vercel > Project > Settings > Environment Variables:
`NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase > Project Settings > API Keys >
anon / publishable key. (If `SUPABASE_ANON_KEY` is already set there, it is
used automatically.) This key is meant to be public; RLS protects the data.
Redeploy after adding it.

## Privacy model
- Profiles (name, @username, picture, bio, city) are visible to everyone so
  people can find each other.
- Plans (Going/Interested), passport and lists marked "Friends" are visible to
  friends = people who follow each other. A public profile shows plans and
  passport to everyone.
- Lists: Only you / Friends / Anyone with the link, per list.
- Saved events sync to the account and are only ever visible to their owner.
- Event pages show total Going/Interested counts (numbers only, no names).
