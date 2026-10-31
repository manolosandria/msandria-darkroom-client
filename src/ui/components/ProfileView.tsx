"use client";

import { useEffect, useState } from "react";
import { PublicProfile } from "@/src/domain/entities/Profile";
import { manageProfile } from "@/src/infrastructure/profileServices";
import { PhotoImage } from "./PhotoImage";
import { ProfileAvatar, ProfilePhotos } from "./ProfileParts";
import "./profiles.css";

const loadProfile = (id: string) => manageProfile.profile(id);

/** `/profile/[id]`: someone's profile. A private one shows only their public name. */
export default function ProfileView({
  id,
  load = loadProfile,
}: {
  id: string;
  load?: (id: string) => Promise<PublicProfile>;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    load(id)
      .then(setProfile)
      .catch(() => setFailed(true));
  }, [id, load]);
  const name = profile?.publicName ?? "A visitor";
  return (
    <main className="upload-workspace">
      <div className="upload-container space-y-6">
        {failed ? (
          <p role="alert">This profile does not exist.</p>
        ) : !profile ? (
          <p role="status">Loading profile…</p>
        ) : profile.profilePublic ? (
          <>
            <div className="profile-cover">
              {profile.cover && (
                <PhotoImage
                  photo={profile.cover}
                  fallbackSizes="100vw"
                  maxWidth={1920}
                />
              )}
            </div>
            <div className="profile-header">
              <ProfileAvatar photo={profile.avatar} />
              <div>
                <h1 className="text-2xl font-semibold">{name}</h1>
                <a href={`mailto:${profile.email}`} className="upload-link">
                  {profile.email}
                </a>
              </div>
            </div>
            {profile.likes && (
              <section className="space-y-3">
                <h2 className="text-lg font-medium">Likes</h2>
                <ProfilePhotos photos={profile.likes} label="Likes" />
              </section>
            )}
            {profile.favorites && (
              <section className="space-y-3">
                <h2 className="text-lg font-medium">Favorites</h2>
                <ProfilePhotos photos={profile.favorites} label="Favorites" />
              </section>
            )}
          </>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold">{name}</h1>
            <p className="text-sm text-gray-600">This profile is private.</p>
          </div>
        )}
      </div>
    </main>
  );
}
