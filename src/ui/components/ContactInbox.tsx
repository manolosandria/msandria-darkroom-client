"use client";
import { useEffect, useState } from "react";
import { InboxMessage } from "@/src/domain/repositories/ContactRepository";
import { manageContact } from "@/src/infrastructure/contactServices";
import { useSessionValue } from "./SessionProvider";

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
          <p>No messages yet.</p>
        ) : (
          <ul className="inbox-messages">
            {messages.map((message) => (
              <li key={message.id} className="upload-card">
                <header>
                  <strong>{message.name}</strong> · {message.email}{" "}
                  {!message.readAt && (
                    <span className="curator-badge">Unread</span>
                  )}
                </header>
                <p className="whitespace-pre-wrap break-words">
                  {message.body}
                </p>
                <small>{new Date(message.createdAt).toLocaleString()}</small>
                <div className="catalog-editor__row">
                  {!message.readAt && (
                    <button
                      className="upload-primary"
                      disabled={busy}
                      onClick={() => act(() => manageContact.read(message.id))}
                    >
                      Mark as read
                    </button>
                  )}
                  <button
                    className="upload-secondary"
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
                    Delete message
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
