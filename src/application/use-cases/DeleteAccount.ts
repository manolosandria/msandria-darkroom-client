import { AccountRepository } from "@/src/domain/repositories/AccountRepository";
export class DeleteAccount {
  constructor(private repository: Pick<AccountRepository, "deleteAccount">) {}
  execute(confirmLastAdmin: boolean) {
    return this.repository.deleteAccount(confirmLastAdmin);
  }
}
