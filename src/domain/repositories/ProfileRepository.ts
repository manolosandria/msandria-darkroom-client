import {
  OwnProfile,
  PhotoReactions,
  ProfileChanges,
  PublicProfile,
  Reaction,
} from "../entities/Profile";

export interface ProfileRepository {
  mine(): Promise<OwnProfile>;
  update(changes: ProfileChanges): Promise<OwnProfile>;
  profile(id: string): Promise<PublicProfile>;
  reactions(photoId: string): Promise<PhotoReactions>;
  react(photoId: string, kind: Reaction, on: boolean): Promise<PhotoReactions>;
}
