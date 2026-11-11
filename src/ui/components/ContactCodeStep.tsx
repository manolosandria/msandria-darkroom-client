"use client";

import { useState } from "react";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { manageContact } from "@/src/infrastructure/contactServices";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { VerificationCodeField } from "./VerificationCodeField";

type Props = {
  email: string;
  verificationId: string;
  onConfirmed: () => void;
  // Back to the form, with the message as it was, to send it again.
  onEdit: () => void;
};

/**
 * The second step of Contact without a session: the message waits until the code
 * emailed to its address is typed here. It is asked every time, even for an address
 * confirmed before; a message never confirmed is deleted when its code expires.
 */
export function ContactCodeStep({
  email,
  verificationId,
  onConfirmed,
  onEdit,
}: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      noValidate
      aria-label="Confirm your message"
      className="upload-card contact-form contact-code"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || code.length !== 6) return;
        setBusy(true);
        setError("");
        try {
          await manageContact.confirm(verificationId, code);
          onConfirmed();
        } catch (failure) {
          setError(
            failure instanceof RateLimitError
              ? rateLimitMessage(failure)
              : failure instanceof Error
                ? failure.message
                : "Could not confirm. Please try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p role="status">
        We sent a 6-digit code to <strong>{email}</strong>. Type it here to send
        your message; it works for 10 minutes. Signed-in visitors skip this step.
      </p>
      <VerificationCodeField value={code} onChange={setCode} disabled={busy} />
      {error && <p role="alert">{error}</p>}
      <button
        className="upload-primary contact-send"
        disabled={busy || code.length !== 6}
      >
        {busy ? "Confirming…" : "Confirm and send"}
        <span aria-hidden="true">→</span>
      </button>
      <div className="contact-code__links">
        <button
          type="button"
          className="upload-link"
          disabled={busy}
          onClick={onEdit}
        >
          Edit the message or the email
        </button>
      </div>
    </form>
  );
}
