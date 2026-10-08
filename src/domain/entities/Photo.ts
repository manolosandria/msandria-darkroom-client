// A web-ready version of the photo, already resized by the image host.
export type PhotoRendition = {
  width: number;
  url: string;
};

export type PhotoParams = {
  id: string;
  title: string;
  renditions: PhotoRendition[];
  description?: string;
  createdAt?: Date;
};

export class Photo {
  private readonly id: string;
  private title: string;
  private description?: string;
  private readonly renditions: PhotoRendition[];
  private readonly createdAt: Date;

  constructor(params: PhotoParams) {
    this.id = params.id;
    this.title = params.title.trim();
    this.renditions = params.renditions
      .map((rendition) => ({ width: rendition.width, url: rendition.url.trim() }))
      .sort((a, b) => a.width - b.width);
    this.description = params.description?.trim();
    this.createdAt = params.createdAt ?? new Date();
    this.validate();
  }

  private validate() {
    if (!this.id) throw new Error("Photo ID is required.");
    if (!this.title) throw new Error("Photo title is required.");
    if (this.renditions.length === 0) throw new Error("Photo needs at least one rendition.");
    if (this.renditions.some((rendition) => !rendition.url || rendition.width <= 0)) {
      throw new Error("Photo renditions need a url and a positive width.");
    }
  }

  getId() {
    return this.id;
  }
  getTitle() {
    return this.title;
  }
  getDescription() {
    return this.description;
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
    const fitting = this.renditions.find((rendition) => rendition.width >= width);
    return (fitting ?? this.renditions[this.renditions.length - 1]).url;
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
