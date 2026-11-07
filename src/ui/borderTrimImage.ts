import { BorderTrim, detectBorder } from "@/src/domain/borderTrim";

/** Sampling size for detection: fine enough to land within a pixel or two of a 4K edge. */
const DETECTION_SIDE = 2000;
/** The trimmed preview only feeds the editors on screen; the API trims the real file. */
const PREVIEW_SIDE = 2560;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be read."));
    image.src = src;
  });
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot read the image's pixels.");
  return { canvas, context };
}

/**
 * Looks for a border of one colour around a local image. The browser draws the image
 * already turned by its EXIF orientation, as the API does before trimming.
 */
export async function findBorder(src: string): Promise<BorderTrim | null> {
  const image = await loadImage(src);
  const scale = Math.min(
    1,
    DETECTION_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const { context } = canvasOf(width, height);
  context.drawImage(image, 0, 0, width, height);
  return detectBorder(context.getImageData(0, 0, width, height).data, width, height);
}

/** Draws what a trim keeps as a new local image, for the frame and highlight editors. */
export async function trimmedPreview(
  src: string,
  trim: BorderTrim,
): Promise<string> {
  const image = await loadImage(src);
  const source = {
    x: trim.x * image.naturalWidth,
    y: trim.y * image.naturalHeight,
    width: trim.width * image.naturalWidth,
    height: trim.height * image.naturalHeight,
  };
  const scale = Math.min(1, PREVIEW_SIDE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const { canvas, context } = canvasOf(width, height);
  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    width,
    height,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("The trimmed preview could not be drawn.");
  return URL.createObjectURL(blob);
}
