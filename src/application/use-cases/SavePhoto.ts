import { Photo } from "@/src/domain/entities/Photo";
import { PhotoRepository } from "@/src/domain/repositories/PhotoRepository";

export class SavePhoto {
  constructor(private repository: Pick<PhotoRepository, "save">) {}
  execute(photo: Photo, original?: Photo) {
    return original ? this.repository.save(photo, original) : this.repository.save(photo);
  }
}
