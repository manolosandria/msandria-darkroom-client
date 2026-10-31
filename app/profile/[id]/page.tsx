"use client";
import { use } from "react";
import MainHeader from "@/src/ui/components/MainHeader";
import ProfileView from "@/src/ui/components/ProfileView";

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <>
      <MainHeader />
      <ProfileView key={id} id={id} />
    </>
  );
}
