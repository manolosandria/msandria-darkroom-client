export class PostConflictError extends Error {
  constructor() {
    super(
      "This post changed while you were editing. Your edits are kept. Reload it before saving.",
    );
    this.name = "PostConflictError";
  }
}
