import type { PhotoCollectionParams } from "../domain/entities/PhotoCollection";

export const cloudinaryPhotoCollectionsData = [
  {
    id: "1",
    title: "Collection 1",
    photos: [
      {
        id: "1",
        title: "Esfera",
        url: "Photos/sjlslihst3ykivpuqj4n",
      },
      {
        id: "2",
        title: "Atardecer",
        url: "Atardecer_heavy_zordwm",
      },
      {
        id: "3",
        title: "Centro",
        url: "Angel_centro_mojp1b",
      },
    ],
  },
] satisfies PhotoCollectionParams[];
