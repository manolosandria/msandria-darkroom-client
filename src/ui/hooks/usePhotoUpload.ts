import { useCallback, useState } from "react";
import {
  PhotoDraft,
  PhotoUploadError,
  PhotoUploadFailure,
  PublishedPhoto,
} from "@/src/domain/repositories/PhotoRepository";

export type PhotoUploadState = {
  uploading: boolean;
  // The last photo that went through, kept so its optimization notes stay on screen
  // while the next one is chosen.
  published: PublishedPhoto | null;
  error: string | null;
};

const INITIAL_STATE: PhotoUploadState = {
  uploading: false,
  published: null,
  error: null,
};

export type PhotoUploadPorts = {
  uploadPhoto: (draft: PhotoDraft) => Promise<PublishedPhoto>;
};

// A form can be submitted with no file picked, so what arrives here is looser than
// the draft the API accepts. Narrowing it is this hook's job, which keeps every
// refusal — the API's and this one — on the same channel.
export type PhotoUploadRequest = Omit<PhotoDraft, "file"> & {
  file: File | null;
};

const NO_FILE_MESSAGE = "Choose a photo to publish.";

const FAILURE_MESSAGES: Record<PhotoUploadFailure, string> = {
  unauthenticated: "The session ended. Sign in again to publish.",
  forbidden: "This account is not allowed to publish photos.",
  tooLarge: "That file is too large for the API. Export it smaller and try again.",
  rejected: "The API rejected the photo",
  unreachable: "Could not reach the API",
};

function messageFor(failure: unknown): string {
  if (failure instanceof PhotoUploadError) {
    // A rejection is the only refusal the API explains in words worth repeating.
    return failure.failure === "rejected"
      ? `${FAILURE_MESSAGES.rejected}: ${failure.message}`
      : FAILURE_MESSAGES[failure.failure];
  }
  return FAILURE_MESSAGES.unreachable;
}

export function usePhotoUpload(ports: PhotoUploadPorts) {
  // Held from the first render on, for the same reason as in `useSession`: fresh
  // collaborators on every render would give every callback a new identity.
  const [{ uploadPhoto }] = useState(() => ports);
  const [state, setState] = useState<PhotoUploadState>(INITIAL_STATE);

  const publish = useCallback(
    async ({ file, ...rest }: PhotoUploadRequest) => {
      if (!file) {
        setState({ uploading: false, published: null, error: NO_FILE_MESSAGE });
        return false;
      }
      setState({ uploading: true, published: null, error: null });
      try {
        const published = await uploadPhoto({ file, ...rest });
        setState({ uploading: false, published, error: null });
        return true;
      } catch (failure) {
        setState({ uploading: false, published: null, error: messageFor(failure) });
        return false;
      }
    },
    [uploadPhoto],
  );

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, publish, reset };
}
