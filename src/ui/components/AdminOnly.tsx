"use client";
import { ReactNode } from "react";
import { ErrorMessage } from "./ErrorMessage";
import { useSessionValue } from "./SessionProvider";

/**
 * Shows `children` to the administrator alone. While the session is still being asked
 * for, it says so; if the API could not be reached, it offers to ask again; anyone else
 * reads what signing in as the administrator would let them do, finishing the sentence
 * with `to`, as in "edit Gallery".
 *
 * Only what appears on screen is decided here: the API settles every permission.
 */
export function AdminOnly({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  const session = useSessionValue();
  if (session.loading) return <p role="status">Loading session…</p>;
  if (session.error)
    return <ErrorMessage message={session.error} onRetry={session.reload} />;
  if (!session.user?.isAdmin())
    return <p>Sign in as the gallery&apos;s administrator to {to}.</p>;
  return <>{children}</>;
}
