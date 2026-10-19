import { PhotoMaintenanceRepository } from "@/src/domain/repositories/PhotoRepository";
import { Photo } from "@/src/domain/entities/Photo";
export class ReplacePhoto {
  constructor(
    private repository: Pick<PhotoMaintenanceRepository, "replace">,
  ) {}
  execute(photo: Photo, file: File, original?: Photo) {
    return original ? this.repository.replace(photo, file, original) : this.repository.replace(photo, file);
  }
}
