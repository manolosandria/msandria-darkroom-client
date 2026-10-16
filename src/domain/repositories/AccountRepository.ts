import { PublicNameStyle } from "../entities/PublicName";
import { User } from "../entities/User";

export type AccountDeletionPreview = { isLastAdmin: boolean };

export interface AccountRepository {
  deletionPreview(): Promise<AccountDeletionPreview>;
  deleteAccount(confirmLastAdmin: boolean): Promise<void>;
  // `alias` left out keeps the stored one; null clears it.
  updatePublicName(style: PublicNameStyle, alias?: string | null): Promise<User>;
}
