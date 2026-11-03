"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OwnProfile, PublicProfile } from "@/src/domain/entities/Profile";
import { manageProfile } from "@/src/infrastructure/profileServices";
import { PhotoImage } from "./PhotoImage";
import { ProfileAvatar, ProfilePhotos } from "./ProfileParts";
import { useSessionValue } from "./SessionProvider";
import { recentRead, rememberRead } from "@/src/ui/recentReads";
import "./profiles.css";

const loadProfile = (id: string) => manageProfile.profile(id);
const loadOwn = () => manageProfile.mine();

type Shown =
  | { own: true; profile: OwnProfile }
  | { own: false; profile: PublicProfile };

/**
 * `/profile/[id]`. Your own profile shows everything to you, whatever its privacy.
 * Someone else's private profile shows only their public name, photo and cover.
 */
export default function ProfileView({
  id,
  load = loadProfile,
  loadMine = loadOwn,
}: {
  id: string;
  load?: (id: string) => Promise<PublicProfile>;
  loadMine?: () => Promise<OwnProfile>;
}) {
  const session = useSessionValue();
  const own = session.user?.getId() === id;
  // Coming back from a photo shows the profile read a moment ago while it is asked again.
  const key = `profile:${own ? "own" : "other"}:${id}`;
  const [shown, setShown] = useState<Shown | null>(
    () => recentRead<Shown>(key) ?? null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Wait for the session: it decides whose view this is.
    if (session.loading) return;
    let live = true;
    const request: Promise<Shown> = own
      ? loadMine().then((profile) => ({ own: true, profile }))
      : load(id).then((profile) => ({ own: false, profile }));
    request
      .then((next) => {
        rememberRead(key, next);
        if (live) setShown(next);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id, own, key, session.loading, load, loadMine]);
  const profile = shown?.profile;
  const name = profile?.publicName ?? "A visitor";
  const full = shown?.own || (profile?.profilePublic ?? false);
  return (
    <main className="upload-workspace">
      <div className="upload-container space-y-6">
        {failed ? (
          <p role="alert">This profile does not exist.</p>
        ) : !profile ? (
          <p role="status">Loading profile…</p>
        ) : (
          <>
            <div className="profile-cover">
              {profile.cover && (
                <PhotoImage
                  photo={profile.cover}
                  fallbackSizes="100vw"
                  maxWidth={1920}
                  crop={profile.cover.getHighlights()?.landscape}
                />
              )}
            </div>
            <div className="profile-header">
              <ProfileAvatar photo={profile.avatar} />
              <div>
                <h1 className="text-2xl font-semibold">{name}</h1>
                {full && "email" in profile && (
                  <a href={`mailto:${profile.email}`} className="upload-link">
                    {profile.email}
                  </a>
                )}
                {!full && (
                  <p className="text-sm text-gray-600">
                    This profile is private.
                  </p>
                )}
              </div>
            </div>
            {shown?.own && (
              <p className="profile-own-note">
                {shown.profile.profilePublic
                  ? "This is your profile as others see it, with the lists you made public."
                  : "Your profile is private: others see only your public name, photo and cover."}{" "}
                <Link href="/account" className="upload-link">
                  Settings
                </Link>
              </p>
            )}
            {full && "likes" in profile && profile.likes && (
              <section className="space-y-3">
                <h2 className="text-lg font-medium">Likes</h2>
                <ProfilePhotos photos={profile.likes} label="Likes" />
              </section>
            )}
            {full && "favorites" in profile && profile.favorites && (
              <section className="space-y-3">
                <h2 className="text-lg font-medium">Favorites</h2>
                <ProfilePhotos photos={profile.favorites} label="Favorites" />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
