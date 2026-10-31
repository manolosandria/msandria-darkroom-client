// Why an email sign-in failed, in this site's words: the link was used, expired or
// mistyped; the address was refused; or the API cannot send email at all.
export type EmailSignInFailure = "invalidLink" | "invalidEmail" | "unavailable";

export class EmailSignInError extends Error {
  constructor(readonly reason: EmailSignInFailure) {
    super(reason);
    this.name = "EmailSignInError";
  }
}
