import { getCldImageUrl } from "next-cloudinary";
import { Photo, PhotoParams } from "../domain/entities/Photo";
import { NewPhotoInput, PhotoRepository } from "../domain/repositories/PhotoRepository";
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

  async save(input: NewPhotoInput): Promise<Photo> {
    const formData = new FormData();
    formData.set("file", input.file);
    formData.set("title", input.title);
    if (input.description) formData.set("description", input.description);

    const response = await fetch("/api/upload", { method: "POST", body: formData });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to upload photo.");
    }

    const result = await response.json();
    return new Photo({
      id: result.id,
      title: result.title,
      description: result.description,
      url: result.url,
    });
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
