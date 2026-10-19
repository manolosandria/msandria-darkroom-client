import { GetUnoptimizedPhotos } from "../application/use-cases/GetUnoptimizedPhotos";
import { ReplacePhoto } from "../application/use-cases/ReplacePhoto";
import { GetAllPhotos } from "../application/use-cases/GetAllPhotos";
import { GetPhotoById } from "../application/use-cases/GetPhotoById";
import { UploadPhoto } from "../application/use-cases/UploadPhoto";
import { SavePhoto } from "../application/use-cases/SavePhoto";
import { ApiPhotoRepository } from "./ApiPhotoRepository";

// Next.js inlines NEXT_PUBLIC_* at build time, so it must be set before building.
const photoRepository = new ApiPhotoRepository(process.env.NEXT_PUBLIC_API_URL);

export const getAllPhotos = new GetAllPhotos(photoRepository);
export const getManagedPhotos = new GetAllPhotos(
  new ApiPhotoRepository(
    process.env.NEXT_PUBLIC_API_URL,
    undefined,
    "/photos/manage",
  ),
);
export const getCollectionPhotos = (id: string) =>
  new GetAllPhotos(
    new ApiPhotoRepository(
      process.env.NEXT_PUBLIC_API_URL,
      undefined,
      `/photos?collection=${encodeURIComponent(id)}`,
    ),
  );
export const getPhotoById = new GetPhotoById(photoRepository);
export const uploadPhoto = new UploadPhoto(photoRepository);
export const savePhoto = new SavePhoto(photoRepository);

export const getUnoptimizedPhotos = new GetUnoptimizedPhotos(photoRepository);
export const replacePhoto = new ReplacePhoto(photoRepository);
