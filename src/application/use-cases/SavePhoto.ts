import { Photo } from "@/src/domain/entities/Photo";
import { PhotoRepository } from "@/src/domain/repositories/PhotoRepository";

export class SavePhoto {
  constructor(private repository: Pick<PhotoRepository, "save">) {}
  execute(photo: Photo) {
    return this.repository.save(photo);
  }
}
