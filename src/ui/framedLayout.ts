import { PhotoFrame } from "@/src/domain/entities/PhotoFrame";

export type FramedLayout = {
  // Padding as a percentage of the framed box's width (what CSS percentages refer to).
  paddingX: number;
  paddingY: number;
  // Framed box height divided by its width, for fitting it inside a height budget.
  heightPerWidth: number;
};

// Frame thicknesses are percentages of the photo's short side, but CSS padding
// percentages are of the box's width. The short side is the width for a portrait and
// width / ratio for a landscape, hence the divisor.
export function framedLayout(ratio: number, frame: PhotoFrame | null): FramedLayout {
  if (!frame) return { paddingX: 0, paddingY: 0, heightPerWidth: 1 / ratio };
  const shortSideShare = 1 / Math.max(ratio, 1);
  const paddingX = frame.leftRight * shortSideShare;
  const paddingY = frame.topBottom * shortSideShare;
  const imageShare = 1 - (2 * paddingX) / 100;
  return {
    paddingX,
    paddingY,
    heightPerWidth: imageShare / ratio + (2 * paddingY) / 100,
  };
}
