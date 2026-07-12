import { Category } from "./Category";
import { Photo, PhotoParams } from "./Photo";

export type PhotoCollectionParams = {
  id: string;
  title: string;
  photos: PhotoParams[];
};

export class PhotoCollection {
  private id: string;
  private photos: Photo[];
  private title: string;
  private categories: Category[];

  constructor(
    id: string,
    title: string,
    photos: Photo[],
    categories?: Category[],
  ) {
    this.id = id;
    this.title = title.trim();
    this.photos = photos;
    this.categories = categories ?? [];
    this.validate();
  }

  validate() {}

  getPhotos() {
    return this.photos;
  }

  getTitle() {
    return this.title;
  }

  getId() {
    if (!this.id) return "Selection";
    return this.id;
  }
}
