import {
  ContactDraft,
  ContactRepository,
} from "../../domain/repositories/ContactRepository";
export class ManageContact {
  constructor(private readonly repository: ContactRepository) {}
  send(draft: ContactDraft) {
    return this.repository.send(draft);
  }
  confirm(verificationId: string, code: string) {
    return this.repository.confirm(verificationId, code);
  }
  inbox() {
    return this.repository.inbox();
  }
  read(id: string) {
    return this.repository.read(id);
  }
  remove(id: string) {
    return this.repository.remove(id);
  }
  block(messageId: string) {
    return this.repository.block(messageId);
  }
  blocked() {
    return this.repository.blocked();
  }
  unblock(id: string) {
    return this.repository.unblock(id);
  }
  notifications() {
    return this.repository.notifications();
  }
  dashboard() {
    return this.repository.dashboard();
  }
}
