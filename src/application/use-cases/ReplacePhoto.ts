import { PhotoMaintenanceRepository } from "@/src/domain/repositories/PhotoRepository";
import { Photo } from "@/src/domain/entities/Photo";
import { BorderTrim } from "@/src/domain/borderTrim";
export class ReplacePhoto {
  constructor(
    private repository: Pick<PhotoMaintenanceRepository, "replace">,
  ) {}
  execute(photo: Photo, file: File, original?: Photo, trim?: BorderTrim) {
    if (trim) return this.repository.replace(photo, file, original, trim);
    return original ? this.repository.replace(photo, file, original) : this.repository.replace(photo, file);
  }
}
