import { AccountRepository } from "@/src/domain/repositories/AccountRepository";
export class GetAccountDeletionPreview {
  constructor(private repository: Pick<AccountRepository, "deletionPreview">) {}
  execute() {
    return this.repository.deletionPreview();
  }
}
