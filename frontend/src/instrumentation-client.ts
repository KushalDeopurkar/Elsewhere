// Browser error reports. Nothing loads or is sent unless NEXT_PUBLIC_SENTRY_DSN
// is set at build time (then the SDK loads after the page, off the critical path).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("./lib/sentryPrivacy")]).then(([Sentry, { PRIVATE }]) => {
    Sentry.init({
      dsn,
      // Errors, plus a small sample of page-load timings.
      tracesSampleRate: 0.05,
      // No user details, cookies, headers, bodies or query strings (see /privacy).
      dataCollection: PRIVATE,
      // Noise from browser extensions and the like.
      ignoreErrors: [
        "ResizeObserver loop",
        "Non-Error promise rejection captured",
        "AbortError",
        // View transitions the browser cancels (tab hidden, a second click).
        /Transition was (aborted|skipped)/,
        // Scripts the iOS Brave and Firefox apps inject into every page
        // (reader mode, YouTube quality): they call window.__firefox__,
        // which isn't there yet. Not our code.
        /__firefox__/,
        // Brave's built-in crypto wallet does the same with window.ethereum.
        /window\.(ethereum|solana|web3)\b/,
      ],
      denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
      // Anything else such an app injects runs as a one-line script with no
      // file of its own: a single "global code" frame on line 1 of the page.
      // The site's own code always comes from /_next/ files, so drop those.
      beforeSend(event) {
        const frames = event.exception?.values?.[0]?.stacktrace?.frames;
        const only = frames?.length === 1 ? frames[0] : null;
        if (only && only.function === "global code" && only.lineno === 1 && !only.filename?.includes("/_next/")) return null;
        return event;
      },
    });
  });
}
