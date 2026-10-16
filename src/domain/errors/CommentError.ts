export type CommentFailure =
  | "unauthenticated"
  | "forbidden"
  | "notFound"
  | "publicNameRequired"
  | "rejected";

// A refusal from the API about a comment, sorted into what the interface can explain.
export class CommentError extends Error {
  constructor(readonly failure: CommentFailure) {
    super(`Comment request refused: ${failure}`);
    this.name = "CommentError";
  }
}
