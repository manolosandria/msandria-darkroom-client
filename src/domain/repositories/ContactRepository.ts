export type ContactDraft = {
  name: string;
  email: string;
  body: string;
  consent: boolean;
  // The hidden trap field: people leave it empty, form-filling programs do not.
  website?: string;
};
// Signed in, a message reaches the inbox at once. Signed out, it waits for the code
// emailed to the address it gives, and `verificationId` names it when confirming.
export type ContactSubmission =
  | { status: "received" }
  | { status: "pending"; verificationId: string; expiresAt: string };
export type InboxMessage = {
  id: string;
  name: string;
  email: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  senderBlocked?: boolean;
};
export type BlockedSender = { id: string; email: string; createdAt: string };
export type CuratorNotifications = { comments: number; inbox: number };
export type CuratorDashboard = CuratorNotifications & {
  unoptimizedPhotos: number;
  storageTasks: number;
  photos: number;
  accounts: number;
};
export interface ContactRepository {
  send(draft: ContactDraft): Promise<ContactSubmission>;
  confirm(verificationId: string, code: string): Promise<void>;
  inbox(): Promise<InboxMessage[]>;
  read(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  block(messageId: string): Promise<void>;
  blocked(): Promise<BlockedSender[]>;
  unblock(id: string): Promise<void>;
  notifications(): Promise<CuratorNotifications>;
  dashboard(): Promise<CuratorDashboard>;
}
