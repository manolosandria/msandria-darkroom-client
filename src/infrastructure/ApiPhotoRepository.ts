import { rateLimitError } from "./rateLimitError";
import {
  Photo,
  PhotoCamera,
  PhotoCollectionPlacement,
  PhotoRendition,
  PhotoVisibility,
} from "../domain/entities/Photo";
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
  visibility?: PhotoVisibility;
  // The administrator's listing names the camera, for Curator's filters.
  camera?: Pick<PhotoCamera, "make" | "model">;
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
  version?: number;
  // Only the administrator's detail carries them.
  visibility?: PhotoVisibility;
  categoryNames?: string[];
  collections?: PhotoCollectionPlacement[];
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
    private readonly listingPath = "/photos",
  ) {}

  async findById(id: string): Promise<Photo | null> {
    const response = await this.get(`/photos/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    const entry = (await this.ensureOk(response).json()) as ApiPhoto;
    return this.isDeliverable(entry) ? this.toDomainPhoto(entry) : null;
  }

  async findAll(): Promise<Photo[] | null> {
    const response = await this.get(this.listingPath);
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
    if (draft.visibility) form.append("visibility", draft.visibility);
    if (draft.categoryNames) form.append("categoryNames", JSON.stringify(draft.categoryNames));
    if (draft.collections) form.append("collections", JSON.stringify(draft.collections));
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

  async replace(photo: Photo, file: File, original?: Photo): Promise<PublishedPhoto> {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(this.editFields(photo, original))) {
      form.append(key, typeof value === "object" && value !== null ? JSON.stringify(value) : value === null ? "" : String(value));
    }
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

  async save(photo: Photo, original?: Photo): Promise<void> {
    const response = await this.send(
      "PATCH",
      `/photos/${encodeURIComponent(photo.getId())}`,
      JSON.stringify(this.editFields(photo, original)),
    );
    if (!response.ok) throw await this.toUploadError(response);
  }

  async delete(_id: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  private get(path: string) {
    return this.send("GET", path);
  }

  // Send only deliberate edits. Replacing a file alone must preserve its classification.
  private editFields(photo: Photo, original?: Photo): Record<string, unknown> {
    const fields = (entry: Photo) => ({
      title: entry.getTitle(),
      description: entry.getDescription()?.trim() || null,
      highlights: entry.getHighlights(),
      titlePosition: entry.getTitlePosition(),
      ...entry.getClassification(),
    });
    const before = original ? fields(original) : null;
    return {
      version: photo.getVersion(),
      ...Object.fromEntries(Object.entries(fields(photo)).filter(([key, value]) =>
        !before || JSON.stringify(value) !== JSON.stringify(before[key as keyof typeof before]),
      )),
    };
  }

  // A private photo's renditions are served by the API itself, which answers with
  // paths relative to its own origin; everything else is already a full URL.
  private absoluteUrl(url: string) {
    return url.startsWith("/")
      ? `${this.baseUrl?.replace(/\/+$/, "") ?? ""}${url}`
      : url;
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
      return new PhotoUploadError("conflict", "This photo changed while you were editing it. Reload its state before saving.");
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
      version: detail?.version,
      title: entry.title,
      description: detail?.description ?? undefined,
      width: entry.width,
      height: entry.height,
      createdAt: new Date(entry.createdAt),
      renditions: entry.renditions.map((rendition) => ({
        ...rendition,
        url: this.absoluteUrl(rendition.url),
      })),
      visibility: entry.visibility,
      categoryNames: detail?.categoryNames,
      collections: detail?.collections,
      highlights: entry.highlights,
      frame: entry.frame,
      titlePosition: detail?.titlePosition,
      metadata: {
        format: detail?.format,
        capturedAt: detail?.capturedAt,
        lastEditDate: detail?.lastEditDate,
        origin: detail?.origin,
        // The listing names only make and model; the detail fills in the rest.
        camera: entry.camera && {
          lens: null,
          iso: null,
          aperture: null,
          exposureTime: null,
          focalLength: null,
          ...entry.camera,
        },
      },
    });
  }
}
