import { Suspense } from "react";
import type { Metadata } from "next";
import ProfileView from "@/components/ProfileView";
import SiteFooter from "@/components/SiteFooter";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username} - Elsewhere` };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return (
    <>
      <div className="shell">
        <Suspense fallback={null}>
          <ProfileView username={decodeURIComponent(username)} />
        </Suspense>
      </div>
      <SiteFooter />
    </>
  );
}
