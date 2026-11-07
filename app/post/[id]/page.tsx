"use client";
import { use } from "react";
import MainHeader from "@/src/ui/components/MainHeader";
import PostView from "@/src/ui/components/PostView";

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <>
      <MainHeader />
      <PostView key={id} postId={id} />
    </>
  );
}
