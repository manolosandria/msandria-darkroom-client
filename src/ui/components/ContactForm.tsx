"use client";
import { useState } from "react";
import { manageContact } from "@/src/infrastructure/contactServices";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { EmptyState } from "./EmptyState";

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
        <div className="upload-heading contact-intro">
          <span className="upload-eyebrow">GET IN TOUCH</span>
          <h1>Let&apos;s talk photography.</h1>
          <p>Send a private message to the photographer.</p>
          <ul className="contact-facts">
            <li>
              <span aria-hidden="true">{contactIcons.private}</span>
              Only the photographer reads it.
            </li>
            <li>
              <span aria-hidden="true">{contactIcons.inbox}</span>
              It waits in a private inbox; no automatic email is sent.
            </li>
            <li>
              <span aria-hidden="true">{contactIcons.length}</span>
              Up to 3,000 characters, without links.
            </li>
          </ul>
        </div>
        {sent ? (
          <div role="status" className="contact-sent">
            <EmptyState picture="done" title="Thank you.">
              Your message is in the photographer&apos;s inbox.
            </EmptyState>
          </div>
        ) : (
          <form
            noValidate
            className="upload-card contact-form"
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
              <button className="upload-primary contact-send">
                {busy ? "Sending…" : "Send message"}
                <span aria-hidden="true">→</span>
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </main>
  );
}

const draw = (d: string) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);
const contactIcons = {
  private: draw("M5 9V7a5 5 0 0 1 10 0v2M4 9h12v8H4zM10 12v2"),
  inbox: draw("M3 11l2.5-6h9L17 11v5H3zM3 11h4l1 2h4l1-2h4"),
  length: draw("M4 5h12M4 9h12M4 13h8M4 17h5"),
};
