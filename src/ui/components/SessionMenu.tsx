"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./navigation.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OwnProfile } from "@/src/domain/entities/Profile";
import { manageProfile } from "@/src/infrastructure/profileServices";
import { PhotoImage } from "./PhotoImage";
import { PROFILE_CHANGED } from "./UseAsProfilePhoto";
import { googleClientId } from "@/src/infrastructure/sessionServices";
import { disableGoogleAutoSelect } from "@/src/infrastructure/googleIdentity";
import GoogleSignInButton from "./GoogleSignInButton";
import { useSessionValue } from "./SessionProvider";
import { useOptionalEditingWorkspace } from "./EditingWorkspace";
import { CuratorBackdropPicker, useCuratorBackdrop } from "./CuratorBackdrop";

export default function SessionMenu() {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const session = useSessionValue();
  const editing = useOptionalEditingWorkspace();
  const pathname = usePathname();
  const backdrop = useCuratorBackdrop();
  const userId = session.user?.getId() ?? null;
  // The profile's photo and cover, asked once per account; without them the button
  // shows the person's initial.
  const [profile, setProfile] = useState<{
    id: string;
    value: OwnProfile;
  } | null>(null);
  // Asked again when a photo was just chosen as profile photo or cover.
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRevision((count) => count + 1);
    window.addEventListener(PROFILE_CHANGED, changed);
    return () => window.removeEventListener(PROFILE_CHANGED, changed);
  }, []);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    manageProfile
      .mine()
      .then((value) => {
        if (live) setProfile({ id: userId, value });
      })
      .catch(() => {
        /* The initial stands in for the photo. */
      });
    return () => {
      live = false;
    };
  }, [userId, revision]);
  const own = profile?.id === userId ? profile.value : null;

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

  // A mouse opens the card by pointing at the account and closes it on leaving; a
  // press still toggles it, and touch and keyboard work as before. A press right
  // after the pointer opened it keeps it open instead of folding it again.
  const hoverOpened = useRef(0);
  const hover = {
    onPointerEnter: (event: React.PointerEvent<HTMLDetailsElement>) => {
      if (event.pointerType !== "mouse" || event.currentTarget.open) return;
      event.currentTarget.open = true;
      hoverOpened.current = Date.now();
    },
    onPointerLeave: (event: React.PointerEvent<HTMLDetailsElement>) => {
      if (event.pointerType !== "mouse") return;
      // Not while a field inside it is in use (the email link's input, a picker).
      if (event.currentTarget.contains(document.activeElement) &&
          document.activeElement?.matches("input, select, textarea"))
        return;
      event.currentTarget.open = false;
    },
    onClickCapture: (event: React.MouseEvent<HTMLDetailsElement>) => {
      if (
        (event.target as Element).closest("summary") &&
        Date.now() - hoverOpened.current < 600
      )
        event.preventDefault();
    },
  };

  const closeOnLeave = {
    onBlur: (event: React.FocusEvent<HTMLDetailsElement>) => {
      // Only when focus moves somewhere else, as with Tab; a press is handled above.
      if (
        event.relatedTarget &&
        !event.currentTarget.contains(event.relatedTarget)
      )
        event.currentTarget.open = false;
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLDetailsElement>) => {
      if (event.key === "Escape" && disclosure.current) {
        disclosure.current.open = false;
        disclosure.current.querySelector("summary")?.focus();
      }
    },
  };

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

  // Signed out, the corner holds one small button; Google and the email link open
  // in a card under it.
  if (!session.user) {
    return (
      <details
        ref={disclosure}
        className="session-menu"
        {...closeOnLeave}
        {...hover}
      >
        <summary aria-label="Sign in" title="Sign in">
          <span className="session-menu__avatar" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </svg>
          </span>
          <span className="session-menu__name">Sign in</span>
        </summary>
        <div className="session-menu__panel session-menu__panel--sign-in">
          <strong>Sign in</strong>
          <small>To comment, like and keep favorites.</small>
          <div className="session-menu__sign-in">
            <GoogleSignInButton
              clientId={googleClientId}
              onCredential={session.signIn}
            />
            <Link href="/sign-in/email" className="session-menu__email">
              Sign in by email
            </Link>
          </div>
        </div>
      </details>
    );
  }

  const admin = session.user.isAdmin();
  return (
    <details
      ref={disclosure}
      className="session-menu"
      data-admin={admin ? "" : undefined}
      {...closeOnLeave}
      {...hover}
    >
      <summary aria-label="Your account" title="Your account">
        <Avatar photo={own?.avatar ?? null} name={session.user.getDisplayName()} />
        <span className="session-menu__name">
          {session.user.getDisplayName()}
        </span>
      </summary>
      <div className="session-menu__panel">
        <div className="session-menu__cover" aria-hidden="true">
          {own?.cover && (
            <PhotoImage
              photo={own.cover}
              fallbackSizes="300px"
              maxWidth={640}
              crop={own.cover.getHighlights()?.landscape}
            />
          )}
        </div>
        <div className="session-menu__identity">
          <Avatar
            photo={own?.avatar ?? null}
            name={session.user.getDisplayName()}
            large
          />
          <strong>{session.user.getDisplayName()}</strong>
          <small>{session.user.getEmail()}</small>
          {session.user.isAdmin() && (
            <Link
              href="/curator?section=Dashboard"
              className="session-menu__role"
              title="Open Curator → Admin"
            >
              Admin
            </Link>
          )}
        </div>
        {/* Curator's backdrop is chosen here, out of the way of its tabs. */}
        {admin && pathname?.startsWith("/curator") && (
          <div className="session-menu__backdrop">
            <small>Curator backdrop</small>
            <CuratorBackdropPicker state={backdrop} />
          </div>
        )}
        <nav className="session-menu__links" aria-label="Account">
          <Link href={`/profile/${session.user.getId()}`}>Profile</Link>
          <Link href="/account">Settings</Link>
          <button
            type="button"
            onClick={() =>
              editing
                ? editing.requestExit(() => {
                    void endSession();
                  })
                : void endSession()
            }
          >
            Sign out
          </button>
        </nav>
      </div>
    </details>
  );
}

/** The profile photo, or the name's initial on the accent colour. */
function Avatar({
  photo,
  name,
  large,
}: {
  photo: OwnProfile["avatar"];
  name: string;
  large?: boolean;
}) {
  return (
    <span
      className={`session-menu__avatar${large ? " is-large" : ""}`}
      aria-hidden="true"
    >
      {photo ? (
        <PhotoImage
          photo={photo}
          fallbackSizes={large ? "64px" : "32px"}
          maxWidth={320}
          crop={photo.getHighlights()?.square}
        />
      ) : (
        name.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}
