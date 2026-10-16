export type PhotoCommentStatus = "PENDING" | "APPROVED";

export type PhotoCommentParams = {
  id: string;
  // Null once the author deleted their account: the text stays, the name does not.
  authorName: string | null;
  body: string;
  status: PhotoCommentStatus;
  createdAt: Date;
  // Whether the visitor asking wrote it, so they can see it pending and delete it.
  mine: boolean;
};

export class PhotoComment {
  constructor(private readonly params: PhotoCommentParams) {
    if (!params.id) throw new Error("Comment ID is required.");
  }

  getId() {
    return this.params.id;
  }
  getAuthorName() {
    return this.params.authorName;
  }
  getBody() {
    return this.params.body;
  }
  getCreatedAt() {
    return this.params.createdAt;
  }
  isPending() {
    return this.params.status === "PENDING";
  }
  isMine() {
    return this.params.mine;
  }
}

// A comment waiting in the moderation queue, with the photo it belongs to.
export type PendingComment = {
  id: string;
  photo: { id: string; title: string };
  authorName: string | null;
  body: string;
  createdAt: Date;
};

export const COMMENT_MAX_LENGTH = 1000;
