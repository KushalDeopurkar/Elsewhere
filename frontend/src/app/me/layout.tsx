import type { Metadata } from "next";

export const metadata: Metadata = { title: "You - Elsewhere", robots: { index: false } };

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
