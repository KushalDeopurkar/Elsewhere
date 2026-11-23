"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import StopNotice from "@/components/StopNotice";

/**
 * Any page that fails to render: report it, then offer a retry. (Event
 * pages have their own, which retries by itself.)
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <StopNotice
      code="ERR"
      label="Signal failure"
      title="This page hit a snag"
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </>
      }
    >
      <p>Something went wrong on our side, and it has been reported. Trying again usually works.</p>
    </StopNotice>
  );
}
