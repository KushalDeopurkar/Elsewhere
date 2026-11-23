import Link from "next/link";
import type { Metadata } from "next";
import StopNotice from "@/components/StopNotice";

export const metadata: Metadata = {
  title: "Page not found - Elsewhere",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <StopNotice
      code="404"
      label="Not on the map"
      title="This stop isn't on the map"
      actions={
        <>
          <Link href="/explore" className="btn btn-primary">Browse events</Link>
          <Link href="/map" className="btn btn-ghost">Open the map</Link>
          <Link href="/" className="btn btn-ghost">Home</Link>
        </>
      }
    >
      <p>The page or event you were looking for has moved, ended or never existed. Events leave the board once they&apos;re over.</p>
    </StopNotice>
  );
}
