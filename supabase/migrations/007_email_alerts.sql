-- 007: email as a second alert channel.
--
-- An alert is delivered on Telegram (telegram_chat_id) or by email (email,
-- once confirmed). Email alerts use double opt-in: email_confirmed_at stays
-- NULL until the person clicks the link in the confirmation email, and
-- nothing else is ever sent to an unconfirmed address. link_token doubles as
-- the secret in the confirm and unsubscribe links.
--
-- Idempotent: safe to run more than once.

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS email TEXT
    CHECK (email IS NULL OR char_length(email) BETWEEN 3 AND 254);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_alerts_email ON alerts (lower(email)) WHERE email IS NOT NULL;

NOTIFY pgrst, 'reload schema';
