// The API refused a profile photo: only photographs of the public gallery qualify.
export class ProfilePhotoError extends Error {
  constructor() {
    super("Choose a photograph from the public gallery.");
    this.name = "ProfilePhotoError";
  }
}
