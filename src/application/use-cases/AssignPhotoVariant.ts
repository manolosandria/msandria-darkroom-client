import { EditCatalog } from "./EditCatalog";
// Re-read the catalog before writing, so sequential uploads preserve earlier members.
export async function assignPhotoVariant(
  catalog: Pick<EditCatalog, "load" | "saveWork">,
  photoId: string,
  targetId: string,
  title: string,
) {
  if (!targetId || photoId === targetId) return;
  const current = await catalog.load();
  const own = current.works.find((work) =>
    work.variants.some((v) => v.photoId === photoId),
  );
  const target = current.works.find((work) =>
    work.variants.some((v) => v.photoId === targetId),
  );
  if (own && own.id === target?.id) return;
  if (own)
    throw new Error(
      "This photo already belongs to a work. Edit its group in Variants before moving it.",
    );
  const photoIds = target
    ? [...target.variants.map((v) => v.photoId), photoId]
    : [targetId, photoId];
  await catalog.saveWork(
    { title: target?.title ?? title, photoIds },
    target?.id,
  );
}
