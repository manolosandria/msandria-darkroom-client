/**
 * What every uploader in Curator accepts (Upload, Posts, Collections and Variants): the
 * formats and size the API's upload pipeline takes, and the title a file starts with.
 */
export const UPLOAD_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];

/** The same list, to name the formats to a person. */
export const UPLOAD_FORMATS = "JPEG, PNG, WebP, AVIF or GIF";

/** The API refuses larger files with 413. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Why a file cannot be uploaded, naming it, or null when it can. */
export function uploadRefusal(file: File): string | null {
  if (!UPLOAD_IMAGE_TYPES.includes(file.type))
    return `${file.name}: choose a ${UPLOAD_FORMATS}.`;
  if (file.size > MAX_UPLOAD_BYTES)
    return `${file.name}: exceeds the 10 MB limit.`;
  return null;
}

/** A first title from the file's name: no extension, and spaces for _ and -. */
export const titleFromFile = (file: File, fallback = "Untitled") =>
  file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || fallback;
