import { GetCurrentUser } from "../application/use-cases/GetCurrentUser";
import { SignIn } from "../application/use-cases/SignIn";
import { SignOut } from "../application/use-cases/SignOut";
import { ApiSessionRepository } from "./ApiSessionRepository";

// Next.js inlines NEXT_PUBLIC_* at build time, so both must be set before building.
const sessionRepository = new ApiSessionRepository(process.env.NEXT_PUBLIC_API_URL);

// The OAuth client id is not a secret: it only says which application a token was
// issued for, and the API checks that the token it receives matches this same id.
export const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export const signIn = new SignIn(sessionRepository);
export const getCurrentUser = new GetCurrentUser(sessionRepository);
export const signOut = new SignOut(sessionRepository);
