"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountDeletionError } from "@/src/domain/errors/AccountDeletionError";
import {
  deleteAccount,
  getAccountDeletionPreview,
} from "@/src/infrastructure/sessionServices";
import { disableGoogleAutoSelect } from "@/src/infrastructure/googleIdentity";
import { usePhotoFetch } from "../hooks/usePhotoFetch";
import { ErrorMessage } from "./ErrorMessage";
import { PublicNameSettings } from "./PublicNameSettings";
import { useSessionValue } from "./SessionProvider";

const loadPreview = () => getAccountDeletionPreview.execute();

export default function AccountSettings() {
  const session = useSessionValue();
  const [deleted, setDeleted] = useState(false);
  const publicName = session.user?.getPublicName();
  return (
    <main className="upload-workspace">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">THE DARKROOM / ACCOUNT</span>
          <h1>Your account.</h1>
        </div>
        {deleted ? (
          <div role="status">
            <p>
              Your account has been deleted and all your sessions have ended.
            </p>
            <Link href="/gallery" className="upload-link">
              Back to the gallery
            </Link>
          </div>
        ) : session.loading ? (
          <p role="status">Loading account…</p>
        ) : session.error ? (
          <ErrorMessage message={session.error} onRetry={session.reload} />
        ) : session.user ? (
          <div className="space-y-8">
            {publicName && (
              <PublicNameSettings
                key={`public-name:${session.user.getId()}`}
                publicName={publicName}
                onSaved={session.replaceUser}
              />
            )}
            <DeletionPanel
              key={`deletion:${session.user.getId()}`}
              onDeleted={() => {
                session.clearSession();
                setDeleted(true);
                disableGoogleAutoSelect();
              }}
            />
          </div>
        ) : (
          <p>Sign in to manage your account.</p>
        )}
      </div>
    </main>
  );
}

function DeletionPanel({ onDeleted }: { onDeleted: () => void }) {
  const preview = usePhotoFetch(
    loadPreview,
    "Account not found.",
    "Could not load account deletion details.",
  );
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [requiresLastAdmin, setRequiresLastAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const lastAdmin = requiresLastAdmin || preview.data?.isLastAdmin === true;
  if (preview.loading)
    return <p role="status">Loading account deletion details…</p>;
  if (preview.error)
    return <ErrorMessage message={preview.error} onRetry={preview.retry} />;
  return (
    <section className="upload-card p-6 md:p-8 max-w-3xl space-y-5">
      <h2 className="text-xl font-semibold">Delete account</h2>
      <p className="text-sm leading-relaxed text-gray-700">
        This permanently deletes your gallery account and ends all your
        sessions. It does not delete your Google account or the gallery&apos;s
        published photographs. Your comments stay, shown as written by a deleted
        user; delete them from each photo first if you want them gone. Signing in with Google again creates a new viewer
        account without administrator access.
      </p>
      {!confirming ? (
        <button
          type="button"
          className="upload-secondary"
          onClick={() => setConfirming(true)}
        >
          Delete my account
        </button>
      ) : (
        <form
          aria-label="Confirm account deletion"
          onSubmit={async (event) => {
            event.preventDefault();
            if (deleting || !acknowledged) return;
            setDeleting(true);
            setError("");
            try {
              await deleteAccount.execute(lastAdmin);
              onDeleted();
            } catch (failure) {
              if (failure instanceof AccountDeletionError) {
                setAcknowledged(false);
                if (failure.reason === "lastAdmin") setRequiresLastAdmin(true);
                else {
                  setRequiresLastAdmin(false);
                  await preview.retry();
                }
                setError(failure.message);
              } else
                setError(
                  "Could not delete your account. Your session has not been cleared. You can try again manually.",
                );
            } finally {
              setDeleting(false);
            }
          }}
        >
          <fieldset disabled={deleting} className="min-w-0 flex flex-col gap-6">
            {lastAdmin && (
              <p role="alert" className="upload-error">
                You are the last administrator. If you delete your account, you
                will need to contact the database administrator to restore
                administrative access.
              </p>
            )}
            <label className="flex items-start gap-3 text-sm leading-relaxed">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-[#536d44]"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />{" "}
              I understand that deleting my account is permanent
              {lastAdmin
                ? " and that I must contact the database administrator to restore administrative access"
                : ""}
              .
            </label>
            {error && (
              <p role="alert" className="upload-error">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              <button
                type="submit"
                className="upload-primary"
                disabled={!acknowledged || deleting}
              >
                {deleting ? "Deleting…" : "Permanently delete my account"}
              </button>
              <button
                type="button"
                className="upload-secondary"
                onClick={() => {
                  setConfirming(false);
                  setAcknowledged(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
