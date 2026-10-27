export class CatalogConflictError extends Error {
  constructor() {
    super("The catalog changed while you were editing. Your edits are kept. Reload its state before saving.");
    this.name = "CatalogConflictError";
  }
}
