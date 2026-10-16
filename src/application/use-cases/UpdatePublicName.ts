import { PublicNameStyle } from "@/src/domain/entities/PublicName";
import { AccountRepository } from "@/src/domain/repositories/AccountRepository";
export class UpdatePublicName {
  constructor(private repository: Pick<AccountRepository, "updatePublicName">) {}
  execute(style: PublicNameStyle, alias?: string | null) {
    return this.repository.updatePublicName(style, alias);
  }
}
