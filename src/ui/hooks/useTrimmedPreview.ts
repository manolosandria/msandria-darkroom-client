"use client";

import { useEffect, useState } from "react";
import { BorderTrim } from "@/src/domain/borderTrim";
import { trimmedPreview } from "@/src/ui/borderTrimImage";

/** Waits for the sides to settle while they are typed or dragged. */
const SETTLE_MS = 250;

/**
 * The local image the editors should show: the original, or what the border trim keeps
 * once it has been drawn. Until then, and if it cannot be drawn, the original stands in.
 */
export function useTrimmedPreview(src: string, trim: BorderTrim | null) {
  const key = trim
    ? `${trim.x}:${trim.y}:${trim.width}:${trim.height}`
    : "";
  const [drawn, setDrawn] = useState<{ for: string; url: string } | null>(null);

  useEffect(() => {
    if (!trim) return;
    let url: string | undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      trimmedPreview(src, trim).then(
        (result) => {
          if (cancelled) {
            URL.revokeObjectURL(result);
            return;
          }
          url = result;
          setDrawn({ for: `${src}|${key}`, url: result });
        },
        () => undefined,
      );
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
    // `key` stands for the trim's numbers, so a new object with the same sides waits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, key]);

  if (!trim) return src;
  return drawn?.for === `${src}|${key}` ? drawn.url : src;
}
