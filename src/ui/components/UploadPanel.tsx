'use client';

import { useState, type FormEvent } from "react";
import { UploadPhoto } from "@/src/application/use-cases/UploadPhoto";
import { uploadPhoto as defaultUploadPhoto } from "@/src/infrastructure/photoServices";
import { LoadingSpinner } from "./LoadingSpinner";
import { ErrorMessage } from "./ErrorMessage";

interface UploadPanelProps {
  uploadPhoto?: Pick<UploadPhoto, "execute">;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function validate(file: File | null, title: string): string | null {
  if (!file) return "Select a photo to upload.";
  if (!file.type.startsWith("image/")) return "Only image files are supported.";
  if (file.size > MAX_FILE_SIZE_BYTES) return "Photo must be smaller than 10MB.";
  if (!title.trim()) return "Give the photo a title.";
  return null;
}

export default function UploadPanel({ uploadPhoto = defaultUploadPhoto }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccess(false);

    const validationError = validate(file, title);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await uploadPhoto.execute({ file: file as File, title: title.trim(), description: description.trim() || undefined });
      setSuccess(true);
      setFile(null);
      setTitle("");
      setDescription("");
      setFileInputKey((key) => key + 1);
    } catch {
      setError("Failed to upload photo. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold mb-4">Upload your photos</h1>
      <p className="text-lg text-gray-600 mb-8">Select a photo to upload to the gallery.</p>

      <form onSubmit={handleSubmit} className="flex flex-col items-center w-full max-w-sm gap-4">
        <input
          key={fileInputKey}
          type="file"
          accept="image/*"
          aria-label="Photo"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full"
        />
        <input
          type="text"
          placeholder="Title"
          aria-label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
        <textarea
          placeholder="Description (optional)"
          aria-label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        />

        {submitting && <LoadingSpinner message="Uploading..." />}
        {error && <ErrorMessage message={error} />}
        {success && <p className="text-green-600 text-sm">Photo uploaded successfully.</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-300 disabled:opacity-50"
        >
          Upload
        </button>
      </form>
    </div>
  );
}
