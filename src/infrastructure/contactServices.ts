import { ManageContact } from "../application/use-cases/ManageContact";
import { ApiContactRepository } from "./ApiContactRepository";
export const manageContact = new ManageContact(
  new ApiContactRepository(process.env.NEXT_PUBLIC_API_URL),
);
