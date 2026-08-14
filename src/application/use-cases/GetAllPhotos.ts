import { PhotoRepository } from "@/src/domain/repositories/PhotoRepository";

export class GetAllPhotos{
    constructor(private photoRepository: PhotoRepository){}

    async execute() {
        const photos = await this.photoRepository.findAll();
        return photos;
    }
}