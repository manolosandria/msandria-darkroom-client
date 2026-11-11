// Why an email sign-in failed, in this site's words: the code was wrong, expired or
// used up; the address was refused; or the API cannot send email at all.
export type EmailSignInFailure = "invalidCode" | "invalidEmail" | "unavailable";

export class EmailSignInError extends Error {
  constructor(readonly reason: EmailSignInFailure) {
    super(reason);
    this.name = "EmailSignInError";
  }
}
