import { GetAllPhotos } from "../application/use-cases/GetAllPhotos";
import { GetPhotoById } from "../application/use-cases/GetPhotoById";
import { CloudinaryPhotoRepository } from "./CloudinaryPhotoRepository";

const photoRepository = new CloudinaryPhotoRepository();

export const getAllPhotos = new GetAllPhotos(photoRepository);
export const getPhotoById = new GetPhotoById(photoRepository);
