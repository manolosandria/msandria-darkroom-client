"use client";

import Link from "next/link";
import { useState } from "react";
import { EmailSignInError } from "@/src/domain/errors/EmailSignInError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { User } from "@/src/domain/entities/User";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { useSessionValue } from "./SessionProvider";
import { VerificationCodeField } from "./VerificationCodeField";

export type EmailSignInPorts = {
  request: (email: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<User>;
};

const failureText = (error: unknown) =>
  error instanceof RateLimitError
    ? rateLimitMessage(error)
    : error instanceof EmailSignInError
      ? {
          invalidCode:
            "That code is wrong or has expired. Check it, or ask for a new one.",
          invalidEmail: "That does not look like an email address.",
          unavailable:
            "Signing in by email is not available right now. Use Google instead.",
        }[error.reason]
      : "Something went wrong. Please try again.";

type Step = "email" | "sending" | "code" | "verifying" | "signedIn";

/**
 * `/sign-in/email`: asks for a one-time code by email and takes it in the same window.
 * The page says the same whether or not the address has an account; one is opened
 * when the code is confirmed.
 */
export default function EmailSignIn({ ports }: { ports: EmailSignInPorts }) {
  const session = useSessionValue();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  // Once a code was asked for, the code form stays while a new one is on its way.
  const [codeAsked, setCodeAsked] = useState(false);

  async function requestCode(again: boolean) {
    setError("");
    setResent(false);
    setStep("sending");
    try {
      await ports.request(email.trim());
      setCode("");
      setCodeAsked(true);
      setStep("code");
      setResent(again);
    } catch (caught) {
      setError(failureText(caught));
      setStep(again ? "code" : "email");
    }
  }

  async function verify() {
    setError("");
    setStep("verifying");
    try {
      session.replaceUser(await ports.verify(email.trim(), code));
      setStep("signedIn");
    } catch (caught) {
      setError(failureText(caught));
      setStep("code");
    }
  }

  const waitingForCode =
    step === "code" || step === "verifying" || (step === "sending" && codeAsked);
  const busy = step === "sending" || step === "verifying";
  const signedIn =
    step === "signedIn" || (session.user !== null && step === "email");

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
          {signedIn ? (
            <div role="status" className="space-y-3">
              <p>You are signed in.</p>
              <Link href="/gallery" className="upload-link">
                Go to the gallery
              </Link>
            </div>
          ) : waitingForCode ? (
            <form
              aria-label="Sign-in code"
              className="space-y-3"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (code.length === 6) void verify();
              }}
            >
              <p role="status" className="text-sm text-gray-700">
                {resent
                  ? `A new code is on its way to ${email.trim()} if it can receive email.`
                  : `If ${email.trim()} can receive email, a 6-digit code is on its way.`}{" "}
                It works once and for 10 minutes.
              </p>
              <VerificationCodeField
                value={code}
                onChange={setCode}
                disabled={busy}
              />
              <button
                type="submit"
                className="upload-primary"
                disabled={busy || code.length !== 6}
              >
                {step === "verifying" ? "Signing in…" : "Sign in"}
              </button>
              <div className="email-sign-in__links">
                <button
                  type="button"
                  className="upload-link"
                  disabled={busy}
                  onClick={() => void requestCode(true)}
                >
                  {step === "sending" ? "Sending…" : "Send a new code"}
                </button>
                <button
                  type="button"
                  className="upload-link"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setCode("");
                    setCodeAsked(false);
                    setStep("email");
                  }}
                >
                  Use a different email
                </button>
              </div>
            </form>
          ) : (
            <form
              aria-label="Email sign-in"
              className="space-y-3"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void requestCode(false);
              }}
            >
              <p className="text-sm text-gray-700">
                We will email you a 6-digit code that signs you in, no password
                needed.
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
                disabled={step === "sending" || !email.trim()}
              >
                {step === "sending" ? "Sending…" : "Email me a code"}
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
