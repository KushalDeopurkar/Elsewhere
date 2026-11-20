import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found - Elsewhere",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <section className="shell auth-cb" style={{ textAlign: "center", padding: "6rem 1rem" }}>
      <p className="eyebrow">404</p>
      <h1>This stop isn&apos;t on the map</h1>
      <p>The page or event you were looking for has moved, ended or never existed.</p>
      <p style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem" }}>
        <Link href="/explore" className="btn btn-primary">Browse events</Link>
        <Link href="/" className="btn">Home</Link>
      </p>
    </section>
  );
}
