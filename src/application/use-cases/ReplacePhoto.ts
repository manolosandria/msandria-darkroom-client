import { PhotoMaintenanceRepository } from "@/src/domain/repositories/PhotoRepository";
import { Photo } from "@/src/domain/entities/Photo";
export class ReplacePhoto {
  constructor(
    private repository: Pick<PhotoMaintenanceRepository, "replace">,
  ) {}
  execute(photo: Photo, file: File) {
    return this.repository.replace(photo, file);
  }
}
