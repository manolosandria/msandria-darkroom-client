import { Photo, PhotoClassification } from './../entities/Photo';
import { PhotoOptimizationIssue } from './../entities/PhotoOptimizationIssue';
import { PhotoHighlights } from '../entities/PhotoHighlights';
import { PhotoFrame } from '../entities/PhotoFrame';

// What the photographer hands in to publish a photo. The file travels as it came off
// the disk: the API's upload pipeline is what resizes it and strips its metadata, and
// doing any of that here would only remove the evidence it reports back.
export type PhotoDraft = Partial<PhotoClassification> & {
  file: File;
  title: string;
  description?: string;
  highlights?: PhotoHighlights;
  frame?: PhotoFrame | null;
};

// The published photo together with what its file was missing. The issues describe the
// file that was handed in, not the one that got stored.
export type PublishedPhoto = {
  photo: Photo;
  optimizationIssues: PhotoOptimizationIssue[];
};

// Why an upload did not go through. The interface turns each of these into something
// to say; only "rejected" carries a reason worth repeating from the API.
export type PhotoUploadFailure =
  | "unauthenticated"
  | "forbidden"
  | "tooLarge"
  | "rejected"
  | "conflict"
  | "unreachable";

export class PhotoUploadError extends Error {
  constructor(
    readonly failure: PhotoUploadFailure,
    message: string,
  ) {
    super(message);
    this.name = "PhotoUploadError";
  }
}

export interface PhotoRepository {
    findById(id: string): Promise<Photo | null>;
    upload(draft: PhotoDraft): Promise<PublishedPhoto>;
    save(photo: Photo, original?: Photo): Promise<void>;
    delete(id: string): Promise<void>;
    findAll(): Promise<Photo[] | null>;
    findCollection(id: string): Promise<Photo[] | null>;
}

export interface PhotoMaintenanceRepository {
  findUnoptimized(): Promise<PublishedPhoto[]>;
  replace(photo: Photo, file: File, original?: Photo): Promise<PublishedPhoto>;
}
