import Link from "next/link";
import { EmptyState } from "./Section";

/**
 * Shown where a feature needs an account and accounts can't be reached.
 * Says what still works on this device, and where to go instead.
 */
export default function AccountsOff({ what }: { what: string }) {
  return (
    <EmptyState
      title={`${what} need an account, and accounts can't be reached right now`}
      body="Everything else works without one: saved events, reminders, your passport and the display setting live on this device."
    >
      <Link href="/saved" className="btn btn-primary">
        Your saved events
      </Link>
      <Link href="/" className="btn btn-ghost">
        Where to be
      </Link>
    </EmptyState>
  );
}
