"use client";

import { useCallback } from "react";
import { googleClientId } from "@/src/infrastructure/sessionServices";
import { disableGoogleAutoSelect } from "@/src/infrastructure/googleIdentity";
import GoogleSignInButton from "./GoogleSignInButton";
import { useSessionValue } from "./SessionProvider";

export default function SessionMenu() {
  const session = useSessionValue();

  const endSession = useCallback(async () => {
    await session.signOut();
    // Otherwise Google offers to sign the visitor straight back in.
    disableGoogleAutoSelect();
  }, [session]);

  // Nothing is shown while the first answer is on its way: flashing a sign-in button
  // at someone who is already signed in reads as having been logged out.
  if (session.loading) {
    return <div className="h-10" aria-busy="true" />;
  }

  if (session.error) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-red-700">{session.error}</span>
        <button type="button" onClick={session.reload} className="underline">
          Retry
        </button>
      </div>
    );
  }

  if (!session.user) {
    return (
      <GoogleSignInButton clientId={googleClientId} onCredential={session.signIn} />
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-semibold text-gray-700">
        {session.user.getDisplayName()}
      </span>
      {session.user.isAdmin() && (
        <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-semibold text-white">
          Admin
        </span>
      )}
      <button type="button" onClick={endSession} className="underline">
        Sign out
      </button>
    </div>
  );
}
