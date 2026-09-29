import { GetAllPhotos } from "../application/use-cases/GetAllPhotos";
import { GetPhotoById } from "../application/use-cases/GetPhotoById";
import { UploadPhoto } from "../application/use-cases/UploadPhoto";
import { CloudinaryPhotoRepository } from "./CloudinaryPhotoRepository";

const photoRepository = new CloudinaryPhotoRepository();

export const getAllPhotos = new GetAllPhotos(photoRepository);
export const getPhotoById = new GetPhotoById(photoRepository);
export const uploadPhoto = new UploadPhoto(photoRepository);
