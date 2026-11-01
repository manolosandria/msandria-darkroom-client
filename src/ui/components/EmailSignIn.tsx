"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EmailSignInError } from "@/src/domain/errors/EmailSignInError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { User } from "@/src/domain/entities/User";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { useSessionValue } from "./SessionProvider";

export type EmailSignInPorts = {
  request: (email: string) => Promise<void>;
  verify: (token: string) => Promise<User>;
};

const failureText = (error: unknown) =>
  error instanceof RateLimitError
    ? rateLimitMessage(error)
    : error instanceof EmailSignInError
      ? {
          invalidLink:
            "This link has expired or was already used. Ask for a new one below.",
          invalidEmail: "That does not look like an email address.",
          unavailable:
            "Signing in by email is not available right now. Use Google instead.",
        }[error.reason]
      : "Something went wrong. Please try again.";

/**
 * `/sign-in/email`: asks for a sign-in link, and trades the one that arrives. The link
 * carries its token in the fragment (`#token=`), which never reaches a server log; it
 * is removed from the address at once, so a reload or a shared URL cannot replay it.
 */
export default function EmailSignIn({ ports }: { ports: EmailSignInPorts }) {
  const session = useSessionValue();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    "idle" | "sending" | "sent" | "verifying" | "signedIn"
  >("idle");
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => setState("verifying"));
    ports
      .verify(token)
      .then((user) => {
        session.replaceUser(user);
        setState("signedIn");
      })
      .catch((caught: unknown) => {
        setError(failureText(caught));
        setState("idle");
      });
  }, [ports, session]);

  return (
    <main className="upload-workspace">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">THE DARKROOM / SIGN IN</span>
          <h1>Sign in by email.</h1>
        </div>
        <section className="upload-card email-sign-in">
          <span className="email-sign-in__mark" aria-hidden="true">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 5h14v10H3zM3 5l7 6 7-6" />
            </svg>
          </span>
          {state === "verifying" ? (
            <p role="status">Signing you in…</p>
          ) : state === "signedIn" || (session.user && state !== "sent") ? (
            <div role="status" className="space-y-3">
              <p>You are signed in.</p>
              <Link href="/gallery" className="upload-link">
                Go to the gallery
              </Link>
            </div>
          ) : state === "sent" ? (
            <p role="status">
              If {email.trim()} can receive email, a sign-in link is on its way.
              It works once and for a short while; open it in this browser.
            </p>
          ) : (
            <form
              aria-label="Email sign-in"
              className="space-y-3"
              noValidate
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setState("sending");
                try {
                  await ports.request(email.trim());
                  setState("sent");
                } catch (caught) {
                  setError(failureText(caught));
                  setState("idle");
                }
              }}
            >
              <p className="text-sm text-gray-700">
                We will email you a link that signs you in, no password needed.
              </p>
              <label className="block">
                <span className="block text-sm font-medium">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <button
                type="submit"
                className="upload-primary"
                disabled={state === "sending" || !email.trim()}
              >
                {state === "sending" ? "Sending…" : "Email me a link"}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
