// Thin wrapper over Google Identity Services, the script that renders the official
// "Sign in with Google" button and hands the page a signed ID token. It is the only
// place that touches `window.google`, so everything above it stays testable.
//
// The token is all the browser gets: there is no redirect back from Google and no
// authorization code to exchange, so the client needs no secret. The API verifies the
// token's signature and that it was issued for this same client id.

export const GOOGLE_IDENTITY_SRC = "https://accounts.google.com/gsi/client";

type CredentialResponse = { credential?: string };

type ButtonOptions = {
  theme: "outline" | "filled_blue" | "filled_black";
  size: "small" | "medium" | "large";
  text: "signin_with" | "signup_with" | "continue_with";
};

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
      }): void;
      renderButton(target: HTMLElement, options: ButtonOptions): void;
      disableAutoSelect(): void;
    };
  };
};

function identity(): GoogleIdentity | undefined {
  return (globalThis as { google?: GoogleIdentity }).google;
}

export function isGoogleIdentityReady(): boolean {
  return identity() !== undefined;
}

export type RenderGoogleButton = (params: {
  target: HTMLElement;
  clientId: string;
  onCredential: (idToken: string) => void;
}) => void;

export const renderGoogleButton: RenderGoogleButton = ({
  target,
  clientId,
  onCredential,
}) => {
  const google = identity();
  if (!google) return;
  google.accounts.id.initialize({
    client_id: clientId,
    // Google calls back with the ID token once the visitor picks an account. An empty
    // credential means the attempt was dismissed, so there is nothing to send on.
    callback: ({ credential }) => {
      if (credential) onCredential(credential);
    },
  });
  google.accounts.id.renderButton(target, {
    theme: "outline",
    size: "large",
    text: "signin_with",
  });
};

// After signing out, stop Google from signing the visitor straight back in on the
// next visit. Signing out has to mean it.
export function disableGoogleAutoSelect(): void {
  identity()?.accounts.id.disableAutoSelect();
}
