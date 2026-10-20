"use client";
import { useState } from "react";
import { manageContact } from "@/src/infrastructure/contactServices";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";

export default function ContactForm() {
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    body: "",
    consent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <main className="upload-workspace">
      <div className="upload-container contact-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">GET IN TOUCH</span>
          <h1>Let&apos;s talk photography.</h1>
          <p>Send a private message to the photographer.</p>
        </div>
        {sent ? (
          <p role="status">
            Your message is in the photographer&apos;s inbox. Thank you.
          </p>
        ) : (
          <form
            noValidate
            className="upload-card"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              const fields = Array.from(event.currentTarget.elements).filter(
                (element): element is HTMLInputElement | HTMLTextAreaElement =>
                  element instanceof HTMLInputElement ||
                  element instanceof HTMLTextAreaElement,
              );
              const invalid = fields.find(
                (field) =>
                  !field.validity.valid ||
                  (field.required &&
                    field.type !== "checkbox" &&
                    field.value.trim().length < field.minLength),
              );
              if (invalid) {
                setError(
                  invalid.type === "email"
                    ? "Enter a valid email address."
                    : invalid.type === "checkbox"
                      ? "Please agree to use your details to handle this inquiry."
                      : invalid instanceof HTMLTextAreaElement
                        ? "Enter a message of at least 10 characters."
                        : "Enter your name (at least 2 characters).",
                );
                invalid.focus();
                return;
              }
              setBusy(true);
              setError("");
              try {
                await manageContact.send(draft);
                setSent(true);
                setDraft({ name: "", email: "", body: "", consent: false });
              } catch (failure) {
                setError(
                  failure instanceof RateLimitError
                    ? "Too many messages. Please wait a minute before trying again."
                    : failure instanceof Error
                      ? failure.message
                      : "Could not send. Your message is still here.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset className="upload-fields" disabled={busy}>
              <label>
                Your name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={draft.email}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                />
              </label>
              <label>
                Message
                <textarea
                  required
                  minLength={10}
                  maxLength={3000}
                  rows={7}
                  value={draft.body}
                  onChange={(event) =>
                    setDraft({ ...draft, body: event.target.value })
                  }
                />
              </label>
              <p className="upload-muted">
                Your name, email and message are stored privately to handle your
                inquiry. Only the administrator can read them. No automatic
                email is sent.
              </p>
              <label className="contact-consent">
                <input
                  type="checkbox"
                  required
                  checked={draft.consent}
                  onChange={(event) =>
                    setDraft({ ...draft, consent: event.target.checked })
                  }
                />
                I agree to use my details to handle this inquiry.
              </label>
              {error && <p role="alert">{error}</p>}
              <button className="upload-primary">
                {busy ? "Sending…" : "Send message"}
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </main>
  );
}
