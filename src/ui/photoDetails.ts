import { PhotoMetadata } from "@/src/domain/entities/Photo";

export type PhotoDetail = { label: string; value: string };

// Capture times are the camera's clock in the project's time zone, so they are shown
// there too, whatever the visitor's own zone.
const PROJECT_TIME_ZONE = "America/Mexico_City";

// Up to one decimal, without a trailing ".0": 2.8, 50, 4.5.
const short = (value: number) => String(Math.round(value * 10) / 10);

// Shutter speeds below a second read as fractions, the way cameras print them.
export function formatExposure(seconds: number) {
  if (seconds >= 1) return `${short(seconds)} s`;
  return `1/${Math.round(1 / seconds)} s`;
}

// Most models already start with the brand ("Canon EOS R6", "NIKON Z 6"); the make is
// only added when it would otherwise be missing ("X-T4" from FUJIFILM).
export function formatCamera(make: string | null, model: string | null) {
  if (!model) return make;
  if (!make) return model;
  const brand = make.split(/\s+/)[0].toLowerCase();
  return model.toLowerCase().startsWith(brand) ? model : `${make} ${model}`;
}

export function formatCapturedAt(capturedAt: string) {
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: PROJECT_TIME_ZONE,
  });
}

// The rows of the info panel, in a fixed order, leaving out whatever was not recorded.
export function photoDetails(metadata: PhotoMetadata): PhotoDetail[] {
  const camera = metadata.camera;
  const rows: [string, string | null | undefined][] = [
    ["Captured", metadata.capturedAt ? formatCapturedAt(metadata.capturedAt) : null],
    ["Camera", camera ? formatCamera(camera.make, camera.model) : null],
    ["Lens", camera?.lens],
    ["Focal length", camera?.focalLength ? `${short(camera.focalLength)} mm` : null],
    ["Aperture", camera?.aperture ? `f/${short(camera.aperture)}` : null],
    ["Shutter speed", camera?.exposureTime ? formatExposure(camera.exposureTime) : null],
    ["ISO", camera?.iso ? String(camera.iso) : null],
  ];
  return rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => ({ label, value }));
}
