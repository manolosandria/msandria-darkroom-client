import { Category } from "./Category";
import { Photo, PhotoParams } from "./Photo";

export type PhotoCollectionParams = {
  id: string;
  title: string;
  photos: PhotoParams[];
};

export class PhotoCollection {
  private readonly id: string;
  private readonly photos: Photo[];
  private readonly title: string;
  private readonly categories: Category[];

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
  }

  getPhotos() {
    return this.photos;
  }

  getTitle() {
    return this.title;
  }

  getId() {
    return this.id;
  }
}
