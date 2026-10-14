'use client';

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { UploadPhoto } from "@/src/application/use-cases/UploadPhoto";
import { PublishedPhoto } from "@/src/domain/repositories/PhotoRepository";
import { uploadPhoto as defaultUploadPhoto } from "@/src/infrastructure/photoServices";
import { usePhotoUpload } from "@/src/ui/hooks/usePhotoUpload";
import { ErrorMessage } from "./ErrorMessage";
import { OptimizationIssueList } from "./OptimizationIssueList";
import { useSessionValue } from "./SessionProvider";

// What the API's upload pipe accepts. Anything else is turned down before the file is
// read, so the picker may as well not offer it.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/avif,image/gif";

interface UploadPanelProps {
  uploadPhoto?: Pick<UploadPhoto, "execute">;
}

export default function UploadPanel({
  uploadPhoto = defaultUploadPhoto,
}: UploadPanelProps) {
  const session = useSessionValue();
  const [ports] = useState(() => ({
    uploadPhoto: (draft: Parameters<UploadPhoto["execute"]>[0]) =>
      uploadPhoto.execute(draft),
  }));
  const { uploading, published, error, publish, reset } = usePhotoUpload(ports);

  // The file is kept as the input handed it over. A file input cannot be read back
  // from the submitted form data, and nothing should rewrite the bytes anyway: the
  // API's pipeline reports on exactly what it received.
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;

      const succeeded = await publish({
        file,
        title,
        description: description || undefined,
      });
      // Only on success, so a rejected photo keeps what was typed for another try.
      if (!succeeded) return;
      // `reset` clears what the file picker shows; the fields are state of our own.
      form.reset();
      setFile(null);
      setTitle("");
      setDescription("");
    },
    [publish, file, title, description],
  );

  if (session.loading) {
    return <Shell aria-busy="true" />;
  }

  // Without an answer about the session there is no telling whether the form would be
  // of any use, and the header already offers the retry.
  if (session.error) {
    return (
      <Shell>
        <ErrorMessage
          message={session.error}
          onRetry={session.reload}
          className="w-full"
        />
      </Shell>
    );
  }

  // The invitation to sign in points at the header, which is where the button lives.
  if (!session.user) {
    return (
      <Shell>
        <p className="text-lg text-gray-600">
          Sign in with the button in the header to publish a photo.
        </p>
      </Shell>
    );
  }

  // A courtesy, not a safeguard: the API turns down a publish from this account
  // whatever this page decides to draw.
  if (!session.user.isAdmin()) {
    return (
      <Shell>
        <p className="text-lg text-gray-600">
          Only the gallery&apos;s administrator can publish photos.
        </p>
        <Link href="/gallery" className="underline">
          Back to the gallery
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      {error && <ErrorMessage message={error} className="w-full" />}

      <form onSubmit={submit} className="w-full space-y-4">
        <div>
          <label htmlFor="file" className="block text-sm font-semibold text-gray-700">
            Photo
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept={ACCEPTED_TYPES}
            disabled={uploading}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
          <p className="mt-1 text-sm text-gray-500">
            The file goes up as it is. The API resizes it, converts it to sRGB and
            strips every tag, the GPS location included, before it reaches the image
            host.
          </p>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-gray-700">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            disabled={uploading}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-semibold text-gray-700"
          >
            Description <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            disabled={uploading}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="rounded bg-blue-500 px-4 py-2 text-white transition duration-300 hover:bg-blue-600 disabled:bg-gray-400"
        >
          {uploading ? "Publishing..." : "Publish"}
        </button>
      </form>

      {published && <PublishedReport published={published} onDismiss={reset} />}
    </Shell>
  );
}

function PublishedReport({
  published,
  onDismiss,
}: {
  published: PublishedPhoto;
  onDismiss: () => void;
}) {
  const { photo, optimizationIssues } = published;

  return (
    <section className="mt-10 w-full rounded-lg border border-gray-200 p-4">
      <h2 className="text-xl font-bold">Published: {photo.getTitle()}</h2>

      <div className="mt-4 flex items-start gap-4">
        <div className="relative h-24 w-24 shrink-0">
          {/* The loader picks one of the renditions the API sent, so Next.js never
              downloads or re-encodes the stored file. */}
          <Image
            loader={({ width }) => photo.urlForWidth(width)}
            src={photo.getId()}
            alt={photo.getTitle()}
            fill
            sizes="6rem"
            className="rounded object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <OptimizationIssueList issues={optimizationIssues} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm">
        <Link href="/gallery" className="underline">
          See it in the gallery
        </Link>
        <button type="button" onClick={onDismiss} className="underline">
          Dismiss
        </button>
      </div>
    </section>
  );
}

function Shell({
  children,
  ...rest
}: {
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-12" {...rest}>
      <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4">
        <h1 className="text-4xl font-bold">Publish a photo</h1>
        {children}
      </div>
    </main>
  );
}
