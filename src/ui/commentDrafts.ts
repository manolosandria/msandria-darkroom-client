// What a visitor has typed for each photo, kept while the page is open so moving to
// another photo and back does not lose it. Only in memory: a draft is not worth
// leaving behind in the browser's storage.
const drafts = new Map<string, string>();

export function readCommentDraft(photoId: string): string {
  return drafts.get(photoId) ?? "";
}

export function saveCommentDraft(photoId: string, body: string) {
  if (body) drafts.set(photoId, body);
  else drafts.delete(photoId);
}

export function clearCommentDrafts() {
  drafts.clear();
}
