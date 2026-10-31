export type ContactDraft = {
  name: string;
  email: string;
  body: string;
  consent: boolean;
};
export type InboxMessage = {
  id: string;
  name: string;
  email: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
export type CuratorNotifications = { comments: number; inbox: number };
export type CuratorDashboard = CuratorNotifications & {
  unoptimizedPhotos: number;
  storageTasks: number;
  photos: number;
  accounts: number;
};
export interface ContactRepository {
  send(draft: ContactDraft): Promise<void>;
  inbox(): Promise<InboxMessage[]>;
  read(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  notifications(): Promise<CuratorNotifications>;
  dashboard(): Promise<CuratorDashboard>;
}
