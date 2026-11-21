import * as Sentry from "@sentry/nextjs";
import { PRIVATE } from "./lib/sentryPrivacy";

/** Server-side error reports, on only when NEXT_PUBLIC_SENTRY_DSN is set. */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    dataCollection: PRIVATE,
    // The visitor closed the tab or moved on while a page was streaming.
    ignoreErrors: [/destination stream closed early/i, /aborted/i],
  });
}

export const onRequestError = Sentry.captureRequestError;
