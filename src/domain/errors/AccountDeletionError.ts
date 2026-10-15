export class AccountDeletionError extends Error {
  constructor(readonly reason: "lastAdmin" | "changed") {
    super(
      reason === "lastAdmin"
        ? "Review the last administrator warning before confirming again."
        : "The account state changed. Review and confirm again.",
    );
    this.name = "AccountDeletionError";
  }
}
