"use client";
import { useEffect, useState } from "react";
import { InboxMessage } from "@/src/domain/repositories/ContactRepository";
import { manageContact } from "@/src/infrastructure/contactServices";
import { useSessionValue } from "./SessionProvider";
import { EmptyState } from "./EmptyState";

export default function ContactInbox() {
  const { user } = useSessionValue();
  return user?.isAdmin() ? (
    <Inbox />
  ) : (
    <p>Sign in as the administrator to read messages.</p>
  );
}
function Inbox() {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setMessages(await manageContact.inbox());
      setError("");
    } catch {
      setError("Could not load the inbox.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      window.dispatchEvent(new Event("curator:refresh"));
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not update the message.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="upload-workspace">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">CURATOR / INBOX</span>
          <h1>Inbox</h1>
          <p>Private inquiries from Contact. Email delivery is not enabled.</p>
        </div>
        {error && (
          <p role="alert">
            {error}{" "}
            <button disabled={busy} onClick={load}>
              Retry inbox
            </button>
          </p>
        )}
        {!messages ? (
          <p>Loading inbox…</p>
        ) : !messages.length ? (
          <EmptyState picture="inbox" title="No messages yet.">
            Messages sent from Contact arrive here.
          </EmptyState>
        ) : (
          <ul className="inbox-messages">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`upload-card message-card${message.readAt ? "" : " message-card--unread"}`}
              >
                <span className="message-card__avatar" aria-hidden="true">
                  {message.name.trim().charAt(0).toUpperCase()}
                </span>
                <header className="message-card__meta">
                  <strong>{message.name}</strong>
                  <a href={`mailto:${message.email}`}>{message.email}</a>
                  {!message.readAt && (
                    <span className="curator-badge">Unread</span>
                  )}
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString()}
                  </time>
                </header>
                <p className="message-card__body">{message.body}</p>
                <div className="message-card__actions">
                  {!message.readAt && (
                    <button
                      className="message-card__approve"
                      disabled={busy}
                      onClick={() => act(() => manageContact.read(message.id))}
                    >
                      <span aria-hidden="true">✓</span>Mark as read
                    </button>
                  )}
                  <button
                    className="message-card__delete"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Permanently delete this message and contact details?",
                        )
                      )
                        void act(() => manageContact.remove(message.id));
                    }}
                  >
                    <span aria-hidden="true">✕</span>Delete message
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
