"use client";

import { useEffect, useRef, useState } from "react";
import { Photo } from "@/src/domain/entities/Photo";
import { OwnProfile } from "@/src/domain/entities/Profile";
import { ProfilePhotoError } from "@/src/domain/errors/ProfilePhotoError";
import { manageProfile } from "@/src/infrastructure/profileServices";
import { PhotoImage } from "./PhotoImage";
import "./profiles.css";

/** Announced after the profile photo or cover changed, so the account menu follows. */
export const PROFILE_CHANGED = "profile:changed";

type Slot = "avatar" | "cover";
const slotNames: Record<Slot, string> = {
  avatar: "Profile photo",
  cover: "Cover",
};

export type UseAsPorts = Pick<typeof manageProfile, "mine" | "update">;

/**
 * "Use as": make this photograph the visitor's profile photo or cover. A dialog asks
 * which, then shows the current one beside this one, and nothing changes until the
 * visitor confirms. The API accepts only photographs of the public gallery.
 */
export function UseAsProfilePhoto({
  photo,
  ports = manageProfile,
}: {
  photo: Photo;
  ports?: UseAsPorts;
}) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    ports
      .mine()
      .then((mine) => live && setProfile(mine))
      .catch(() => live && setError("Your profile could not be loaded."));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setSlot(null);
      trigger.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      live = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, ports]);

  function close() {
    setOpen(false);
    setSlot(null);
    setError("");
    trigger.current?.focus();
  }

  async function confirm() {
    if (!slot) return;
    setBusy(true);
    setError("");
    try {
      await ports.update(
        slot === "avatar"
          ? { avatarPhotoId: photo.getId() }
          : { coverPhotoId: photo.getId() },
      );
      window.dispatchEvent(new Event(PROFILE_CHANGED));
      setDone(`${slotNames[slot]} updated.`);
      close();
    } catch (caught) {
      setError(
        caught instanceof ProfilePhotoError
          ? "Only photographs of the public gallery can be used."
          : "That did not go through. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const current = slot && profile ? profile[slot] : null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setDone("");
          setOpen(true);
        }}
      >
        <span aria-hidden="true">◐</span>
        Use as
      </button>
      {done && (
        <span role="status" className="text-xs text-green-800">
          {done}
        </span>
      )}
      {open && (
        <div className="use-as" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="use-as-title"
            className="use-as__card"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="use-as-title">
              {slot ? `New ${slotNames[slot].toLowerCase()}` : "Use this photograph as"}
            </h2>
            {!slot ? (
              <div className="use-as__choices">
                {(Object.keys(slotNames) as Slot[]).map((each) => (
                  <button
                    key={each}
                    type="button"
                    autoFocus={each === "avatar"}
                    onClick={() => setSlot(each)}
                  >
                    <span className={`use-as__shape use-as__shape--${each}`} />
                    {slotNames[each]}
                  </button>
                ))}
              </div>
            ) : (
              <div className="use-as__compare">
                <figure>
                  <div className={`use-as__frame use-as__frame--${slot}`}>
                    {current && (
                      <PhotoImage
                        photo={current}
                        fallbackSizes="200px"
                        maxWidth={640}
                        crop={
                          slot === "avatar"
                            ? current.getHighlights()?.square
                            : undefined
                        }
                      />
                    )}
                  </div>
                  <figcaption>{current ? "Now" : "Now: none"}</figcaption>
                </figure>
                <span aria-hidden="true" className="use-as__arrow">
                  →
                </span>
                <figure>
                  <div className={`use-as__frame use-as__frame--${slot}`}>
                    <PhotoImage
                      photo={photo}
                      fallbackSizes="200px"
                      maxWidth={640}
                      crop={
                        slot === "avatar"
                          ? photo.getHighlights()?.square
                          : undefined
                      }
                    />
                  </div>
                  <figcaption>New</figcaption>
                </figure>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="use-as__actions">
              <button
                type="button"
                onClick={() => (slot ? setSlot(null) : close())}
              >
                {slot ? "Back" : "Cancel"}
              </button>
              {slot && (
                <button
                  type="button"
                  className="use-as__confirm"
                  disabled={busy || !profile}
                  autoFocus
                  onClick={() => void confirm()}
                >
                  {busy ? "Saving…" : `Use as ${slotNames[slot].toLowerCase()}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
