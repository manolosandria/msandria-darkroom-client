import { getCldImageUrl } from "next-cloudinary";
import { Photo, PhotoParams } from "../domain/entities/Photo";
import { PhotoRepository } from "../domain/repositories/PhotoRepository";
import { photoData } from "../data/photoData";

const NOT_IMPLEMENTED_MESSAGE =
  "CloudinaryPhotoRepository does not support this operation yet.";

export class CloudinaryPhotoRepository implements PhotoRepository {
  async findById(id: string): Promise<Photo | null> {
    const entry = photoData.find((photo) => photo.id === id);
    return entry ? this.toDomainPhoto(entry) : null;
  }

  async findAll(): Promise<Photo[] | null> {
    const photos = photoData.map((entry) => this.toDomainPhoto(entry));
    return photos.length > 0 ? photos : null;
  }

  async findCollection(_id: string): Promise<Photo[] | null> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async save(_photo: Photo): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async delete(_id: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  private toDomainPhoto(entry: PhotoParams): Photo {
    return new Photo({
      id: entry.id,
      title: entry.title,
      url: getCldImageUrl({
        src: entry.id,
        width: "auto",
        height: "auto",
      }),
    });
  }
}
