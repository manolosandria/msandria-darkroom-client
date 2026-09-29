import { NewPhotoInput, PhotoRepository } from "@/src/domain/repositories/PhotoRepository";

export class UploadPhoto {
    constructor(private photoRepository: PhotoRepository){}

    async execute(input: NewPhotoInput) {
        const photo = await this.photoRepository.save(input);
        return photo;
    }
}
