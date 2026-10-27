"use client";

import { useState } from "react";
import { Photo } from "@/src/domain/entities/Photo";

// Public photos may be stored on two image hosts. When the image fails to load from
// the one the API chose, switch once to the other; there is no second retry, so a
// photo missing everywhere cannot loop. The switch is remembered per photo id, so
// moving to another photo starts again from its primary host.
export function useImageFallback(photo: Photo) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const useFallback = failedId === photo.getId();
  const onError = () => {
    if (!useFallback && photo.hasFallback()) setFailedId(photo.getId());
  };
  return { useFallback, onError };
}
