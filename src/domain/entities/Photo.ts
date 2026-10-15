import { PhotoFrame } from "./PhotoFrame";
import { PhotoHighlights } from "./PhotoHighlights";
import { PHOTO_QUALITY_WIDTH, PhotoQuality } from "./PhotoQuality";

export type PhotoMetadata = {
  format?: string;
  capturedAt?: string | null;
  lastEditDate?: string | null;
  origin?: string;
};
// A web-ready version of the photo, already resized by the image host.
export type PhotoRendition = {
  width: number;
  url: string;
};

export type PhotoParams = {
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
  metadata?: PhotoMetadata;
};

export class Photo {
  private readonly highlights: PhotoHighlights;
  private readonly frame: PhotoFrame | null;
  private readonly metadata: PhotoMetadata;
  private readonly id: string;
  private title: string;
  private description?: string;
  private readonly width: number;
  private readonly height: number;
  private readonly renditions: PhotoRendition[];
  private readonly createdAt: Date;

  constructor(params: PhotoParams) {
    this.highlights = params.highlights ?? {};
    this.frame = params.frame ?? null;
    this.metadata = params.metadata ?? {};
    this.id = params.id;
    this.title = params.title.trim();
    this.width = params.width;
    this.height = params.height;
    this.renditions = params.renditions
      .map((rendition) => ({
        width: rendition.width,
        url: rendition.url.trim(),
      }))
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
  getHighlights() {
    return this.highlights;
  }
  getFrame() {
    return this.frame;
  }
  getMetadata() {
    return this.metadata;
  }
  getWidth() {
    return this.width;
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
  getRenditions() {
    return this.renditions;
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
  urlForQuality(quality: PhotoQuality) {
    const cap = PHOTO_QUALITY_WIDTH[quality];
    const allowed = this.renditions.filter((rendition) => rendition.width <= cap);
    return (allowed.length > 0 ? allowed[allowed.length - 1] : this.renditions[0]).url;
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
