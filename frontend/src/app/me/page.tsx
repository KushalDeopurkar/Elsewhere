"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/** "You" tab: your profile when signed in, your passport otherwise. */
export default function MePage() {
  const { ready, profile, session } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (session && !profile) return; // profile still loading
    router.replace(profile ? `/u/${profile.username}` : "/passport");
  }, [ready, session, profile, router]);
  return (
    <div className="shell auth-cb" aria-live="polite">
      <span className="auth-spin" aria-hidden="true" />
    </div>
  );
}
