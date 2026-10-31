"use client";

import Link from "next/link";
import "./navigation.css";
import { useCallback, useEffect, useRef } from "react";
import { googleClientId } from "@/src/infrastructure/sessionServices";
import { disableGoogleAutoSelect } from "@/src/infrastructure/googleIdentity";
import GoogleSignInButton from "./GoogleSignInButton";
import { useSessionValue } from "./SessionProvider";
import { useOptionalEditingWorkspace } from "./EditingWorkspace";

export default function SessionMenu() {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const session = useSessionValue();
  const editing = useOptionalEditingWorkspace();

  // A press outside closes the menu. Closing it on blur instead would also fire when
  // the press lands on its own plain text (name, email, the Admin label): focus drops
  // to the body mid-click, and collapsing the disclosure under that click crashes the
  // tab in Chromium (STATUS_BREAKPOINT).
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const menu = disclosure.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

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
      <div className="flex flex-wrap justify-center items-center gap-3 text-sm">
        <span className="text-red-700">{session.error}</span>
        <button type="button" onClick={session.reload} className="underline">
          Retry
        </button>
      </div>
    );
  }

  if (!session.user) {
    return (
      <div className="session-menu__sign-in">
        <GoogleSignInButton
          clientId={googleClientId}
          onCredential={session.signIn}
        />
        <Link href="/sign-in/email" className="session-menu__email">
          Sign in by email
        </Link>
      </div>
    );
  }

  return (
    <details
      ref={disclosure}
      className="session-menu"
      onBlur={(event) => {
        // Only when focus moves somewhere else, as with Tab; a press is handled above.
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && disclosure.current) {
          disclosure.current.open = false;
          disclosure.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="Your account" title="Your account">
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </svg>
      </summary>
      <div className="session-menu__panel">
        <strong>{session.user.getDisplayName()}</strong>
        <small>{session.user.getEmail()}</small>
        <Link
          href="/account"
          className="font-semibold text-gray-700 underline"
          aria-label="Account settings"
        >
          View your account
        </Link>
        {session.user.isAdmin() && (
          <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-semibold text-white">
            Admin
          </span>
        )}
        <button
          type="button"
          onClick={() =>
            editing
              ? editing.requestExit(() => {
                  void endSession();
                })
              : void endSession()
          }
          className="underline"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}
