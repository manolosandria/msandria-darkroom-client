import { PhotoFrame } from "./PhotoFrame";
import { PhotoHighlights } from "./PhotoHighlights";
import { PHOTO_QUALITY_WIDTH, PhotoQuality } from "./PhotoQuality";
import { DEFAULT_TITLE_POSITION, PhotoTitlePosition } from "./PhotoTitlePosition";

// How the photo was taken, as read from its EXIF by the API. Aperture is an f-number,
// exposure time is in seconds and focal length in millimetres; null when not recorded.
export type PhotoCamera = {
  make: string | null;
  model: string | null;
  lens: string | null;
  iso: number | null;
  aperture: number | null;
  exposureTime: number | null;
  focalLength: number | null;
};

export type PhotoMetadata = {
  camera?: PhotoCamera;
  format?: string;
  capturedAt?: string | null;
  lastEditDate?: string | null;
  origin?: string;
};
// A web-ready version of the photo, already resized by the image host.
export type PhotoRendition = {
  width: number;
  url: string;
  // The same rendition on the other image host, to try only when `url` fails to load.
  fallbackUrl?: string;
};

// Who may see a photo. Select is reserved for special accounts that do not exist yet,
// so for now it behaves like private; collections-only photos appear in their
// collections and nowhere else.
export type PhotoVisibility = "PUBLIC" | "PRIVATE" | "SELECT" | "COLLECTIONS_ONLY";

// Where a photo sits in a collection, counting from 1.
export type PhotoCollectionPlacement = { id: string; position: number };

export type PhotoClassification = {
  visibility: PhotoVisibility;
  categoryNames: string[];
  collections: PhotoCollectionPlacement[];
};

export type PhotoParams = Partial<PhotoClassification> & {
  version?: number;
  id: string;
  title: string;
  // Pixel size of the original: only its proportion matters to the layout.
  width: number;
  height: number;
  renditions: PhotoRendition[];
  description?: string;
  createdAt?: Date;
  highlights?: PhotoHighlights;
  frame?: PhotoFrame | null;
  titlePosition?: PhotoTitlePosition;
  metadata?: PhotoMetadata;
};

export class Photo {
  private readonly version: number;
  private readonly classification: PhotoClassification;
  private readonly highlights: PhotoHighlights;
  private readonly frame: PhotoFrame | null;
  private readonly titlePosition: PhotoTitlePosition;
  private readonly metadata: PhotoMetadata;
  private readonly id: string;
  private title: string;
  private description?: string;
  private readonly width: number;
  private readonly height: number;
  private readonly renditions: PhotoRendition[];
  private readonly createdAt: Date;

  constructor(params: PhotoParams) {
    this.version = params.version ?? 1;
    this.classification = {
      visibility: params.visibility ?? "PUBLIC",
      categoryNames: params.categoryNames ?? [],
      collections: params.collections ?? [],
    };
    this.highlights = params.highlights ?? {};
    this.frame = params.frame ?? null;
    this.titlePosition = params.titlePosition ?? DEFAULT_TITLE_POSITION;
    this.metadata = params.metadata ?? {};
    this.id = params.id;
    this.title = params.title.trim();
    this.width = params.width;
    this.height = params.height;
    this.renditions = params.renditions
      .map((rendition) => {
        const fallbackUrl = rendition.fallbackUrl?.trim();
        return {
          width: rendition.width,
          url: rendition.url.trim(),
          ...(fallbackUrl ? { fallbackUrl } : {}),
        };
      })
      .sort((a, b) => a.width - b.width);
    this.description = params.description?.trim();
    this.createdAt = params.createdAt ?? new Date();
    this.validate();
  }

  private validate() {
    if (!this.id) throw new Error("Photo ID is required.");
    if (!this.title) throw new Error("Photo title is required.");
    if (!(this.width > 0 && this.height > 0))
      throw new Error("Photo needs a positive width and height.");
    if (this.renditions.length === 0)
      throw new Error("Photo needs at least one rendition.");
    if (
      this.renditions.some(
        (rendition) => !rendition.url || rendition.width <= 0,
      )
    ) {
      throw new Error("Photo renditions need a url and a positive width.");
    }
  }

  getId() {
    return this.id;
  }
  getClassification() {
    return this.classification;
  }
  getHighlights() {
    return this.highlights;
  }
  getFrame() {
    return this.frame;
  }
  getTitlePosition() {
    return this.titlePosition;
  }
  getMetadata() {
    return this.metadata;
  }
  getWidth() {
    return this.width;
  }
  getVersion() {
    return this.version;
  }
  getHeight() {
    return this.height;
  }
  getTitle() {
    return this.title;
  }
  getDescription() {
    return this.description;
  }
  // Width divided by height: above 1 is landscape, below 1 is portrait.
  getAspectRatio() {
    return this.width / this.height;
  }
  // With `useFallback`, every rendition that has a copy on the other image host points
  // there instead; the rest keep their own URL.
  getRenditions(useFallback = false): PhotoRendition[] {
    return useFallback
      ? this.renditions.map(({ width, url, fallbackUrl }) => ({
          width,
          url: fallbackUrl ?? url,
        }))
      : this.renditions;
  }
  hasFallback() {
    return this.renditions.some((rendition) => rendition.fallbackUrl);
  }
  getCreatedAt() {
    return this.createdAt;
  }

  // The smallest rendition that still fills `width` pixels, or the largest one
  // when none is wide enough: never download more than the screen needs.
  urlForWidth(width: number) {
    const fitting = this.renditions.find(
      (rendition) => rendition.width >= width,
    );
    return (fitting ?? this.renditions[this.renditions.length - 1]).url;
  }

  // The widest rendition the quality level allows, or the narrowest one when even that
  // is over the cap: a photo always has something to show.
  urlForQuality(quality: PhotoQuality, useFallback = false) {
    const cap = PHOTO_QUALITY_WIDTH[quality];
    const renditions = this.getRenditions(useFallback);
    const allowed = renditions.filter((rendition) => rendition.width <= cap);
    return (allowed.length > 0 ? allowed[allowed.length - 1] : renditions[0]).url;
  }

  rename(newTitle: string) {
    const t = newTitle.trim();
    if (!t) throw new Error("Photo title cannot be empty.");
    this.title = t;
  }

  updateDescription(newDescription: string) {
    this.description = newDescription.trim();
  }
}
