import { PhotoVisibility } from "@/src/domain/entities/Photo";

export const VISIBILITY_LABELS: Record<PhotoVisibility, string> = {
  PUBLIC: "Public",
  COLLECTIONS_ONLY: "Collections only",
  POSTS_ONLY: "Posts only",
  PRIVATE: "Private",
  SELECT: "Select",
};

/**
 * The small round mark a thumbnail carries in the corner when its photo is not
 * public: a lock, a star for select accounts, or a square for collections or posts
 * only. Public photos carry none.
 */
export function VisibilityBadge({
  visibility,
}: {
  visibility: PhotoVisibility;
}) {
  if (visibility === "PUBLIC") return null;
  return (
    <span data-visibility={visibility} title={VISIBILITY_LABELS[visibility]}>
      {visibility === "PRIVATE" ? "🔒" : visibility === "SELECT" ? "★" : "▣"}
    </span>
  );
}
