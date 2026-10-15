"use client";
import { use } from "react";
import PhotoViewer from "@/src/ui/components/PhotoViewer";

export default function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PhotoViewer key={id} photoId={id} />;
}
