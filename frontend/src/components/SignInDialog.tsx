"use client";

import { useEffect, useRef, useState } from "react";
import { EnvelopeSimple, GoogleLogo, X, CheckCircle } from "@phosphor-icons/react/ssr";
import { closeSignIn, signInWithEmail, signInWithGoogle, useAuth } from "@/lib/auth";

/** Google or an email link. Opened from anywhere with openSignIn(reason). */
export default function SignInDialog() {
  const { prompt, session } = useAuth();
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = prompt !== null && !session;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const reset = () => {
    setSent(false);
    setError(null);
    setBusy(null);
  };

  return (
    <dialog
      ref={ref}
      className="signin"
      aria-labelledby="signin-title"
      onClose={() => {
        closeSignIn();
        reset();
      }}
      onClick={(e) => e.target === e.currentTarget && closeSignIn()}
    >
      {open && (
        <div className="signin-body">
          <button type="button" className="icon-btn signin-x" aria-label="Close" onClick={() => closeSignIn()}>
            <X size={18} weight="bold" />
          </button>
          <h2 id="signin-title">Sign in to Elsewhere</h2>
          <p className="signin-why">Sign in {prompt}. Browsing, swiping and planning stay open without an account.</p>

          {sent ? (
            <p className="signin-sent" role="status">
              <CheckCircle size={20} weight="fill" aria-hidden="true" /> Check {email} for a sign-in link. Open it in this browser.
            </p>
          ) : (
            <>
              <button
                type="button"
                className="btn signin-google"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("google");
                  setError(null);
                  const err = await signInWithGoogle();
                  if (err) {
                    setError(err);
                    setBusy(null);
                  }
                }}
              >
                <GoogleLogo size={18} weight="bold" aria-hidden="true" /> {busy === "google" ? "Opening Google…" : "Continue with Google"}
              </button>
              <div className="signin-or" aria-hidden="true"><span>or</span></div>
              <form
                className="signin-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
                  setBusy("email");
                  setError(null);
                  const err = await signInWithEmail(email.trim());
                  setBusy(null);
                  if (err) setError(err);
                  else setSent(true);
                }}
              >
                <label htmlFor="signin-email">Email</label>
                <div className="signin-row">
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={error ? "signin-err" : undefined}
                  />
                  <button type="submit" className="btn btn-primary" disabled={busy !== null}>
                    <EnvelopeSimple size={17} weight="bold" aria-hidden="true" /> {busy === "email" ? "Sending…" : "Email me a link"}
                  </button>
                </div>
              </form>
            </>
          )}
          {error && (
            <p id="signin-err" className="signin-err" role="alert">
              {error}
            </p>
          )}
          <p className="signin-fine">
            What you mark Going is visible to friends (people you both follow) unless you make your profile public.
          </p>
        </div>
      )}
    </dialog>
  );
}
