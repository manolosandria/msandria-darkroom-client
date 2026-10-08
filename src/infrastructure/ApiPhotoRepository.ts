import { Photo, PhotoRendition } from "../domain/entities/Photo";
import { PhotoRepository } from "../domain/repositories/PhotoRepository";

const NOT_IMPLEMENTED_MESSAGE =
  "ApiPhotoRepository does not support this operation yet.";

// The subset of the API's photo response the gallery uses. Image URLs come
// ready-made from the API: the client never talks to the image host directly.
type ApiPhoto = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  renditions: PhotoRendition[];
};

export class ApiPhotoRepository implements PhotoRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async findById(id: string): Promise<Photo | null> {
    const response = await this.get(`/photos/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    const entry = (await this.ensureOk(response).json()) as ApiPhoto;
    return this.isDeliverable(entry) ? this.toDomainPhoto(entry) : null;
  }

  async findAll(): Promise<Photo[] | null> {
    const response = await this.get("/photos");
    const entries = (await this.ensureOk(response).json()) as ApiPhoto[];
    const photos = entries
      .filter((entry) => this.isDeliverable(entry))
      .map((entry) => this.toDomainPhoto(entry));
    return photos.length > 0 ? photos : null;
  }

  async findCollection(_id: string): Promise<Photo[] | null> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async save(_photo: Photo): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async delete(_id: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  private get(path: string) {
    if (!this.baseUrl) {
      throw new Error("NEXT_PUBLIC_API_URL is not set: the gallery cannot reach the API.");
    }
    return this.fetchFn(`${this.baseUrl.replace(/\/+$/, "")}${path}`);
  }

  private ensureOk(response: Response) {
    if (!response.ok) {
      throw new Error(`The API answered ${response.status} ${response.statusText}`.trim());
    }
    return response;
  }

  // A photo whose stored file is gone comes without renditions: nothing to show.
  private isDeliverable(entry: ApiPhoto) {
    return entry.renditions.length > 0;
  }

  private toDomainPhoto(entry: ApiPhoto): Photo {
    return new Photo({
      id: entry.id,
      title: entry.title,
      description: entry.description ?? undefined,
      createdAt: new Date(entry.createdAt),
      renditions: entry.renditions,
    });
  }
}
