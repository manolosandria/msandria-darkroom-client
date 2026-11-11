"use client";
import { useEffect, useState } from "react";
import { AdminOnly } from "./AdminOnly";
import {
  BlockedSender,
  InboxMessage,
} from "@/src/domain/repositories/ContactRepository";
import { manageContact } from "@/src/infrastructure/contactServices";
import { EmptyState } from "./EmptyState";
import "./verificationCode.css";

export default function ContactInbox() {
  return (
    <AdminOnly to="read messages">
      <Inbox />
    </AdminOnly>
  );
}
function Inbox() {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [blocked, setBlocked] = useState<BlockedSender[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [inbox, senders] = await Promise.all([
        manageContact.inbox(),
        manageContact.blocked(),
      ]);
      setMessages(inbox);
      setBlocked(senders);
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
          <p>
            Private inquiries from Contact. Each new one is also emailed to the
            administrators, up to an hourly limit.
          </p>
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
                  {message.senderBlocked && (
                    <span className="curator-badge">Sender blocked</span>
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
                  {!message.senderBlocked && (
                    <button
                      className="message-card__delete"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Block ${message.email}? Their future messages will be dropped without telling them.`,
                          )
                        )
                          void act(() => manageContact.block(message.id));
                      }}
                    >
                      <span aria-hidden="true">⊘</span>Block sender
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {blocked.length > 0 && (
          <section aria-label="Blocked senders" className="upload-card inbox-blocked">
            <h2>Blocked senders</h2>
            <p className="upload-muted">
              Messages from these addresses are dropped without telling them.
            </p>
            <ul>
              {blocked.map((sender) => (
                <li key={sender.id}>
                  {sender.email}{" "}
                  <button
                    className="upload-link"
                    disabled={busy}
                    onClick={() =>
                      void act(() => manageContact.unblock(sender.id))
                    }
                  >
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
