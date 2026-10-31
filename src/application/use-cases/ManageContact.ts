import {
  ContactDraft,
  ContactRepository,
} from "../../domain/repositories/ContactRepository";
export class ManageContact {
  constructor(private readonly repository: ContactRepository) {}
  send(draft: ContactDraft) {
    return this.repository.send(draft);
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
  notifications() {
    return this.repository.notifications();
  }
  dashboard() {
    return this.repository.dashboard();
  }
}
