import { ManageProfile } from "../application/use-cases/ManageProfile";
import { ApiPhotoRepository } from "./ApiPhotoRepository";
import { ApiProfileRepository } from "./ApiProfileRepository";

const baseUrl = process.env.NEXT_PUBLIC_API_URL;
const photos = new ApiPhotoRepository(baseUrl);

export const profileRepository = new ApiProfileRepository(baseUrl, (entry) =>
  photos.fromListing(entry),
);
export const manageProfile = new ManageProfile(profileRepository);
