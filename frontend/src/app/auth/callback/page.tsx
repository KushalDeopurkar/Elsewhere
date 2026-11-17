"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { takeReturnPath } from "@/lib/auth";

/**
 * Where Google and email links land. The Supabase client exchanges the code
 * in the URL for a session on its own (PKCE); this page waits for it and
 * sends the person back to where they started.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    const url = new URL(window.location.href);
    const err = url.searchParams.get("error_description") || url.hash.match(/error_description=([^&]+)/)?.[1];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      router.replace(takeReturnPath());
    };
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) finish();
    });
    void sb.auth.getSession().then(({ data: d }) => d.session && finish());
    const t = window.setTimeout(() => {
      if (!done) setFailed(err ? decodeURIComponent(err.replace(/\+/g, " ")) : "The link may have expired or was opened in a different browser.");
    }, 8000);
    const fail = err ? window.setTimeout(() => setFailed(decodeURIComponent(err.replace(/\+/g, " "))), 0) : 0;
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(t);
      window.clearTimeout(fail);
    };
  }, [router]);

  return (
    <div className="shell auth-cb" aria-live="polite">
      {failed ? (
        <>
          <h1>Couldn&apos;t sign you in</h1>
          <p>{failed}</p>
          <Link href="/" className="btn btn-primary">Back to Elsewhere</Link>
        </>
      ) : (
        <>
          <span className="auth-spin" aria-hidden="true" />
          <p>Signing you in…</p>
        </>
      )}
    </div>
  );
}
