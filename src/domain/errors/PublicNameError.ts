// The API turned down a public name: an alias that breaks the rules, or choosing an
// alias without writing one.
export class PublicNameError extends Error {
  constructor() {
    super("Public name rejected");
    this.name = "PublicNameError";
  }
}
