import { getCldImageUrl } from "next-cloudinary";
import { Photo } from "../domain/entities/Photo";
import { PhotoRepository } from "../domain/repositories/PhotoRepository";
import { photoData } from "../data/photoData";

export class CloudinaryPhotoRepository implements PhotoRepository {
  async findById(id: string): Promise<Photo | null> {
    const provider_asset_id = photoData.find((photo) => photo.id === id)?.id;
    if (!provider_asset_id) return Promise.resolve(null);
    const photo = new Photo({
      id: id,
      title: "Photo title",
      url: getCldImageUrl({
        src: provider_asset_id,
        width: "auto",
        height: "auto",
      }),
    });
    return Promise.resolve(photo);
  }

  async save(photo: Photo): Promise<void> {
    return Promise.reject();
  }

  async delete(id: string): Promise<void> {
    return Promise.reject();
  }

  async findAll(): Promise<Photo[]> {
    return [];
  }

  async findCollection(id: string): Promise<Photo[] | null> {
    return null;
  }
}
