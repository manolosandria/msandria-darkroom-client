import { rateLimitError } from "./rateLimitError";
import { Photo, PhotoCamera, PhotoRendition } from "../domain/entities/Photo";
import { PhotoFrame } from "../domain/entities/PhotoFrame";
import { PhotoTitlePosition } from "../domain/entities/PhotoTitlePosition";
import { PhotoHighlights } from "../domain/entities/PhotoHighlights";
import {
  PhotoOptimizationIssue,
  PhotoOptimizationIssueKind,
  PhotoOptimizationIssueResolution,
  PhotoOptimizationIssueUnit,
} from "../domain/entities/PhotoOptimizationIssue";
import {
  PhotoDraft,
  PhotoMaintenanceRepository,
  PhotoRepository,
  PhotoUploadError,
  PublishedPhoto,
} from "../domain/repositories/PhotoRepository";

const NOT_IMPLEMENTED_MESSAGE =
  "ApiPhotoRepository does not support this operation yet.";

// The subset of the API's photo response the gallery uses. Image URLs come
// ready-made from the API: the client never talks to the image host directly.
type ApiPhotoListItem = {
  id: string;
  title: string;
  width: number;
  height: number;
  createdAt: string;
  renditions: PhotoRendition[];
  highlights?: PhotoHighlights;
  frame?: PhotoFrame | null;
};

type ApiPhoto = ApiPhotoListItem & {
  description: string | null;
  format?: string;
  capturedAt?: string | null;
  lastEditDate?: string | null;
  origin?: string;
  camera?: PhotoCamera;
  titlePosition?: PhotoTitlePosition;
};

type ApiOptimizationIssue = {
  kind: PhotoOptimizationIssueKind;
  resolution: PhotoOptimizationIssueResolution;
  // The API measures; `unit` says in what, and the wording is this site's business.
  unit: PhotoOptimizationIssueUnit;
  currentValue: string;
  recommendedValue: string;
};

// What the API answers to a publish: the photo plus what its file was missing. Only
// an administrator is told this much.
type ApiReviewedPhoto = ApiPhoto & {
  optimizationIssues: ApiOptimizationIssue[];
};

export class ApiPhotoRepository implements PhotoRepository, PhotoMaintenanceRepository {
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
    const entries = (await this.ensureOk(response).json()) as ApiPhotoListItem[];
    const photos = entries
      .filter((entry) => this.isDeliverable(entry))
      .map((entry) => this.toDomainPhoto(entry));
    return photos.length > 0 ? photos : null;
  }

  // The file goes up untouched as `multipart/form-data`. `Content-Type` is left for the
  // browser to write, because only it knows the boundary that separates the parts;
  // setting the header by hand produces a body the API cannot read.
  async upload(draft: PhotoDraft): Promise<PublishedPhoto> {
    const form = new FormData();
    form.append("file", draft.file);
    form.append("title", draft.title);
    if (draft.description) form.append("description", draft.description);
    if (draft.highlights)
      form.append("highlights", JSON.stringify(draft.highlights));

    const response = await this.send("POST", "/photos", form);
    if (!response.ok) throw await this.toUploadError(response);

    const entry = (await response.json()) as ApiReviewedPhoto;
    return {
      photo: this.toDomainPhoto(entry),
      optimizationIssues: (entry.optimizationIssues ?? []).map(
        (issue) => new PhotoOptimizationIssue(issue),
      ),
    };
  }

  async findUnoptimized(): Promise<PublishedPhoto[]> {
    const response = await this.get("/photos/unoptimized");
    if (!response.ok) throw await this.toUploadError(response);
    return ((await response.json()) as ApiReviewedPhoto[])
      .filter((entry) => this.isDeliverable(entry))
      .map((entry) => this.toReviewedPhoto(entry))
      .filter((entry) => entry.optimizationIssues.some((issue) => issue.isPending()));
  }

  async replace(photo: Photo, file: File): Promise<PublishedPhoto> {
    const form = new FormData();
    form.append("file", file);
    form.append("title", photo.getTitle());
    form.append("description", photo.getDescription()?.trim() || "");
    form.append("highlights", JSON.stringify(photo.getHighlights()));
    form.append("titlePosition", photo.getTitlePosition());
    const response = await this.send("POST", `/photos/${encodeURIComponent(photo.getId())}/file`, form);
    if (!response.ok) throw await this.toUploadError(response);
    return this.toReviewedPhoto((await response.json()) as ApiReviewedPhoto);
  }

  private toReviewedPhoto(entry: ApiReviewedPhoto): PublishedPhoto {
    return { photo: this.toDomainPhoto(entry), optimizationIssues: entry.optimizationIssues.map((issue) => new PhotoOptimizationIssue(issue)) };
  }

  async findCollection(_id: string): Promise<Photo[] | null> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async save(photo: Photo): Promise<void> {
    const response = await this.send(
      "PATCH",
      `/photos/${encodeURIComponent(photo.getId())}`,
      JSON.stringify({
        title: photo.getTitle(),
        // The API keeps "no description" as null; an empty string would store one.
        description: photo.getDescription()?.trim() || null,
        highlights: photo.getHighlights(),
        titlePosition: photo.getTitlePosition(),
      }),
    );
    if (!response.ok) throw await this.toUploadError(response);
  }

  async delete(_id: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  private get(path: string) {
    return this.send("GET", path);
  }

  // `credentials: "include"` is what makes the browser attach the session cookie to a
  // cross-origin call. Reads do not need a session today, but the API decides that per
  // route and an anonymous request would simply be told no.
  private send(method: string, path: string, body?: BodyInit) {
    if (!this.baseUrl) {
      throw new Error(
        "NEXT_PUBLIC_API_URL is not set: the gallery cannot reach the API.",
      );
    }
    return this.fetchFn(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
      method,
      credentials: "include",
      ...(typeof body === "string"
        ? { headers: { "Content-Type": "application/json" } }
        : {}),
      ...(body === undefined ? {} : { body }),
    });
  }

  private ensureOk(response: Response) {
    if (!response.ok) {
      throw new Error(
        `The API answered ${response.status} ${response.statusText}`.trim(),
      );
    }
    return response;
  }

  // Each refusal means something different to whoever is publishing, so the status is
  // translated here rather than handed on as a number.
  private async toUploadError(response: Response): Promise<Error> {
    if (response.status === 429) return rateLimitError(response);
    if (response.status === 401) {
      return new PhotoUploadError(
        "unauthenticated",
        "There is no live session.",
      );
    }
    if (response.status === 403) {
      return new PhotoUploadError(
        "forbidden",
        "This account cannot publish photos.",
      );
    }
    if (response.status === 409) {
      return new PhotoUploadError("rejected", "The photo changed. Reload before replacing it.");
    }
    if (response.status === 413) {
      return new PhotoUploadError(
        "tooLarge",
        "The file is over the API's size limit.",
      );
    }
    if (response.status === 400 || response.status === 422) {
      return new PhotoUploadError("rejected", await this.reasonGiven(response));
    }
    return new PhotoUploadError(
      "unreachable",
      `The API answered ${response.status} ${response.statusText}`.trim(),
    );
  }

  // A rejection explains itself in `message`, as one string or a list of them. A body
  // that is not the expected JSON leaves the status to speak for itself.
  private async reasonGiven(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: string | string[] };
      const message = Array.isArray(body.message)
        ? body.message.join(". ")
        : body.message;
      if (message) return message;
    } catch {
      // Falls through to the generic wording below.
    }
    return "The API rejected the photo.";
  }

  // A photo whose stored file is gone comes without renditions: nothing to show.
  private isDeliverable(entry: ApiPhotoListItem) {
    return entry.renditions.length > 0;
  }

  private toDomainPhoto(entry: ApiPhotoListItem | ApiPhoto): Photo {
    const detail = "description" in entry ? entry : undefined;
    return new Photo({
      id: entry.id,
      title: entry.title,
      description: detail?.description ?? undefined,
      width: entry.width,
      height: entry.height,
      createdAt: new Date(entry.createdAt),
      renditions: entry.renditions,
      highlights: entry.highlights,
      frame: entry.frame,
      titlePosition: detail?.titlePosition,
      metadata: {
        format: detail?.format,
        capturedAt: detail?.capturedAt,
        lastEditDate: detail?.lastEditDate,
        origin: detail?.origin,
        camera: detail?.camera,
      },
    });
  }
}
