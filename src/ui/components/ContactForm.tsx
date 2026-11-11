"use client";
import "./contactSettings.css";
import {
  ContactSettings,
  defaultContactSettings,
} from "@/src/domain/entities/ContactSettings";
import { contrastRatio, siteFonts } from "@/src/domain/entities/SiteSettings";
import { manageContactSettings } from "@/src/infrastructure/contactSettingsServices";
import { CSSProperties, useEffect, useState } from "react";
import { manageContact } from "@/src/infrastructure/contactServices";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { EmptyState } from "./EmptyState";
import { ContactCodeStep } from "./ContactCodeStep";
import { useOptionalSessionValue } from "./SessionProvider";

const emptyDraft = { name: "", email: "", body: "", consent: false, website: "" };

export default function ContactForm({
  settings: previewSettings,
  preview = false,
}: {
  settings?: ContactSettings;
  preview?: boolean;
}) {
  const [loaded, setLoaded] = useState(defaultContactSettings);
  useEffect(() => {
    if (previewSettings) return;
    let live = true;
    manageContactSettings
      .get()
      .then((settings) => {
        if (live) setLoaded(settings);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [previewSettings]);
  const settings = previewSettings ?? loaded;
  // Signed in, the message is signed with the account's email and needs no code.
  const accountEmail = useOptionalSessionValue()?.user?.getEmail() ?? null;
  const [pending, setPending] = useState<{
    verificationId: string;
    email: string;
  } | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <main
      className="upload-workspace contact-page"
      data-layout={settings.layout}
      style={
        {
          "--contact-background": settings.background,
          "--contact-surface": settings.surface,
          "--contact-text": settings.text,
          "--contact-accent": settings.accent,
          "--contact-button-text":
            contrastRatio(settings.accent, "#ffffff") >=
            contrastRatio(settings.accent, "#000000")
              ? "#ffffff"
              : "#000000",
          "--contact-heading-font": siteFonts[settings.headingFont],
        } as CSSProperties
      }
    >
      <div className="upload-container contact-container">
        <div className="contact-intro">
          <span className="upload-eyebrow">{settings.eyebrow}</span>
          <h1>{settings.title}</h1>
          <p>{settings.description}</p>
          {settings.showFacts && (
            <ul className="contact-facts">
              <li>
                <span aria-hidden="true">{contactIcons.private}</span>
                Only the photographer reads it.
              </li>
              <li>
                <span aria-hidden="true">{contactIcons.inbox}</span>
                Signed out, you confirm it with a code sent to your email.
              </li>
              <li>
                <span aria-hidden="true">{contactIcons.length}</span>
                Up to 3,000 characters, without links.
              </li>
            </ul>
          )}
        </div>
        {sent ? (
          <div role="status" className="contact-sent">
            <EmptyState picture="done" title="Thank you.">
              Your message is in the photographer&apos;s inbox.
            </EmptyState>
          </div>
        ) : pending ? (
          <ContactCodeStep
            email={pending.email}
            verificationId={pending.verificationId}
            onConfirmed={() => {
              setPending(null);
              setSent(true);
              setDraft(emptyDraft);
            }}
            onEdit={() => setPending(null)}
          />
        ) : (
          <form
            noValidate
            className="upload-card contact-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || preview) return;
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
                const email = accountEmail ?? draft.email.trim();
                const result = await manageContact.send({ ...draft, email });
                if (result.status === "pending") {
                  setPending({ verificationId: result.verificationId, email });
                } else {
                  setSent(true);
                  setDraft(emptyDraft);
                }
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
            <fieldset className="upload-fields" disabled={busy || preview}>
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
                  value={accountEmail ?? draft.email}
                  readOnly={accountEmail !== null}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                />
              </label>
              {/* A trap for programs that fill every field: hidden from people and
                  from assistive technology, never focused by Tab. */}
              <input
                type="text"
                name="website"
                className="contact-trap"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={draft.website}
                onChange={(event) =>
                  setDraft({ ...draft, website: event.target.value })
                }
              />
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
                inquiry and emailed to the administrator, who alone reads them.
                Signed out, we first email you a code to confirm the address.
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
                {busy ? "Sending…" : settings.buttonText}
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
