export type PhotoParams = {
  id: string;
  title: string;
  url: string;
  description?: string;
  createdAt?: Date;
};

export class Photo {
  private readonly id: string;
  private title: string;
  private description?: string;
  private url: string;
  private readonly createdAt: Date;

  constructor(params: PhotoParams) {
    this.id = params.id;
    this.title = params.title.trim();
    this.url = params.url.trim();
    this.description = params.description?.trim();
    this.createdAt = params.createdAt ?? new Date();
    this.validate();
  }

  private validate() {
    if (!this.id) throw new Error("Photo ID is required.");
    if (!this.title) throw new Error("Photo title is required.");
    if (!this.url) throw new Error("Photo URL is required.");
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
  getUrl() {
    return this.url;
  }
  getCreatedAt() {
    return this.createdAt;
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
