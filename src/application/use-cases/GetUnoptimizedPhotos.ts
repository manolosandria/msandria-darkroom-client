import { PhotoMaintenanceRepository } from "@/src/domain/repositories/PhotoRepository";

export class GetUnoptimizedPhotos {
  constructor(
    private repository: Pick<PhotoMaintenanceRepository, "findUnoptimized">,
  ) {}
  execute() {
    return this.repository.findUnoptimized();
  }
}
