import { GetAllPhotos } from "../application/use-cases/GetAllPhotos";
import { GetPhotoById } from "../application/use-cases/GetPhotoById";
import { ApiPhotoRepository } from "./ApiPhotoRepository";

// Next.js inlines NEXT_PUBLIC_* at build time, so it must be set before building.
const photoRepository = new ApiPhotoRepository(process.env.NEXT_PUBLIC_API_URL);

export const getAllPhotos = new GetAllPhotos(photoRepository);
export const getPhotoById = new GetPhotoById(photoRepository);
