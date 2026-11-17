"use client";

import { useEffect } from "react";
import SignInDialog from "./SignInDialog";
import { installSync } from "@/lib/sync";
import { socialConfigured } from "@/lib/supabase";

/** App-wide social plumbing: account sync and the sign-in dialog. */
export default function SocialRoot() {
  useEffect(() => {
    if (socialConfigured) installSync();
  }, []);
  return socialConfigured ? <SignInDialog /> : null;
}
