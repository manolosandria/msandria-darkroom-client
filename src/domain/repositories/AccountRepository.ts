export type AccountDeletionPreview = { isLastAdmin: boolean };

export interface AccountRepository {
  deletionPreview(): Promise<AccountDeletionPreview>;
  deleteAccount(confirmLastAdmin: boolean): Promise<void>;
}
