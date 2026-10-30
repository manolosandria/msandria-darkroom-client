import { Photo } from "./entities/Photo";
import {
  Highlight,
  PhotoHighlights,
  GalleryViewRule,
} from "./entities/PhotoHighlights";
export type PhotoView = {
  id: string;
  name: string;
  crop?: Highlight;
  ratio: number;
};
export function photoViews(
  highlights: PhotoHighlights,
  ratio: number,
): PhotoView[] {
  return [
    { id: "original", name: "Original", ratio },
    ...(["square", "landscape", "portrait"] as const).flatMap((id) => {
      const crop = highlights[id];
      return crop
        ? [
            {
              id,
              name: id[0].toUpperCase() + id.slice(1),
              crop,
              ratio: (ratio * crop.width) / crop.height,
            },
          ]
        : [];
    }),
    ...(highlights.custom ?? []).map((item) => ({
      id: `custom:${item.id}`,
      name: item.name,
      crop: item.crop,
      ratio: (ratio * item.crop.width) / item.crop.height,
    })),
  ];
}
export type GalleryViewContext = { layout: string; crops: string };
export function viewAspect(ratio: number) {
  return Math.abs(ratio - 1) <= 0.05
    ? "square"
    : ratio < 1
      ? "portrait"
      : "landscape";
}
export function enabledPhotoViews(
  photo: Photo,
  target: "gallery" | "home",
  context?: GalleryViewContext,
) {
  const highlights = photo.getHighlights();
  const enabled = highlights.presentation?.[target] ?? ["original"];
  const rules = highlights.presentation?.galleryRules;
  return photoViews(highlights, photo.getAspectRatio()).filter((view) => {
    const aspect = viewAspect(view.ratio);
    const allowed =
      target === "gallery" && context && rules
        ? (rules.find(
            (rule) => rule.layout === context.layout && rule.aspect === aspect,
          )?.views ?? [])
        : enabled;
    return (
      enabled.includes(view.id) &&
      allowed.includes(view.id) &&
      (!context ||
        context.crops === "mixed" ||
        (context.crops === "rectangular"
          ? aspect !== "square"
          : aspect === context.crops))
    );
  });
}
export function cleanPresentation(
  highlights: PhotoHighlights,
): PhotoHighlights {
  if (!highlights.presentation) return highlights;
  const ids = new Set(photoViews(highlights, 1).map((view) => view.id));
  return {
    ...highlights,
    presentation: {
      gallery: highlights.presentation.gallery.filter((id) => ids.has(id)),
      home: highlights.presentation.home.filter((id) => ids.has(id)),
      ...(highlights.presentation.galleryRules
        ? {
            galleryRules: highlights.presentation.galleryRules.map((rule) => ({
              ...rule,
              views: rule.views.filter((id) => ids.has(id)),
            })),
          }
        : {}),
    },
  };
}

export function choosePhotoView(
  photo: Photo,
  target: "gallery" | "home",
  seed: string,
  context?: GalleryViewContext,
): PhotoView | undefined {
  const views = enabledPhotoViews(photo, target, context);
  if (!views.length) return undefined;
  let hash = 0;
  for (const char of seed + photo.getId())
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return views[hash % views.length];
}

export function galleryViewRules(
  highlights: PhotoHighlights,
  ratio: number,
): GalleryViewRule[] {
  const views = photoViews(highlights, ratio);
  return ["uniform", "random", "justified"].flatMap((layout) =>
    ["portrait", "square", "landscape"].map((aspect) => ({
      layout,
      aspect,
      views:
        highlights.presentation?.galleryRules?.find(
          (rule) => rule.layout === layout && rule.aspect === aspect,
        )?.views ??
        (highlights.presentation?.galleryRules
          ? []
          : (highlights.presentation?.gallery ?? ["original"]).filter((id) =>
              views.some(
                (view) => view.id === id && viewAspect(view.ratio) === aspect,
              ),
            )),
    })),
  );
}
export function updateGalleryRule(
  highlights: PhotoHighlights,
  viewId: string,
  checked: boolean,
  ratio: number,
  layout?: string,
  aspect?: string,
): PhotoHighlights {
  const view = photoViews(highlights, ratio).find(
    (item) => item.id === viewId,
  )!;
  const ownAspect = viewAspect(view.ratio);
  const rules = galleryViewRules(highlights, ratio).map((rule) =>
    (!layout || rule.layout === layout) && (!aspect || rule.aspect === aspect)
      ? {
          ...rule,
          views:
            checked && rule.aspect === ownAspect
              ? [...new Set([...rule.views, viewId])]
              : rule.views.filter((id) => id !== viewId),
        }
      : rule,
  );
  return {
    ...highlights,
    presentation: {
      ...highlights.presentation,
      home: highlights.presentation?.home ?? ["original"],
      gallery: [
        ...new Set([
          ...(highlights.presentation?.gallery ?? ["original"]),
          ...rules.flatMap((rule) => rule.views),
        ]),
      ].filter((id) => rules.some((rule) => rule.views.includes(id))),
      galleryRules: rules,
    },
  };
}
