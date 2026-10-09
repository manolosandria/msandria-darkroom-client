"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GOOGLE_IDENTITY_SRC,
  RenderGoogleButton,
  isGoogleIdentityReady,
  renderGoogleButton,
} from "@/src/infrastructure/googleIdentity";

type Props = {
  clientId: string | undefined;
  onCredential: (idToken: string) => void;
  // Injected in tests so they never load Google's script.
  renderButton?: RenderGoogleButton;
};

export default function GoogleSignInButton({
  clientId,
  onCredential,
  renderButton = renderGoogleButton,
}: Props) {
  const target = useRef<HTMLDivElement>(null);
  // The script may already be in place from an earlier page, in which case onLoad
  // never fires again.
  const [ready, setReady] = useState(isGoogleIdentityReady);
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!ready || !clientId || !target.current) return;
    renderButton({ target: target.current, clientId, onCredential });
  }, [ready, clientId, onCredential, renderButton]);

  // Without the client id there is nothing to ask Google for, and a button that
  // cannot work is worse than none: say what is missing instead.
  if (!clientId) {
    return (
      <p className="text-sm text-gray-500">
        Sign-in unavailable: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set.
      </p>
    );
  }

  return (
    <>
      <Script src={GOOGLE_IDENTITY_SRC} onLoad={markReady} />
      <div ref={target} data-testid="google-signin-button" />
    </>
  );
}
