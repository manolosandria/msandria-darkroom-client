import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disableGoogleAutoSelect,
  isGoogleIdentityReady,
  renderGoogleButton,
} from "../googleIdentity";

type Callback = (response: { credential?: string }) => void;

function installGoogleStub() {
  const initialize = vi.fn();
  const renderButton = vi.fn();
  const disableAutoSelect = vi.fn();
  (globalThis as Record<string, unknown>).google = {
    accounts: { id: { initialize, renderButton, disableAutoSelect } },
  };
  return { initialize, renderButton, disableAutoSelect };
}

const credentialCallback = (initialize: ReturnType<typeof vi.fn>): Callback =>
  (initialize.mock.calls[0][0] as { callback: Callback }).callback;

afterEach(() => {
  delete (globalThis as Record<string, unknown>).google;
});

describe("isGoogleIdentityReady", () => {
  it("is false before Google's script has run", () => {
    expect(isGoogleIdentityReady()).toBe(false);
  });

  it("is true once the script is in place", () => {
    installGoogleStub();

    expect(isGoogleIdentityReady()).toBe(true);
  });
});

describe("renderGoogleButton", () => {
  it("initialises Google with the client id and renders into the target", () => {
    const { initialize, renderButton } = installGoogleStub();
    const target = document.createElement("div");

    renderGoogleButton({ target, clientId: "client-123", onCredential: vi.fn() });

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "client-123" }),
    );
    expect(renderButton).toHaveBeenCalledWith(target, expect.any(Object));
  });

  it("forwards the ID token Google hands back", () => {
    const { initialize } = installGoogleStub();
    const onCredential = vi.fn();

    renderGoogleButton({
      target: document.createElement("div"),
      clientId: "client-123",
      onCredential,
    });
    credentialCallback(initialize)({ credential: "google-id-token" });

    expect(onCredential).toHaveBeenCalledWith("google-id-token");
  });

  // Google calls back with nothing when the visitor closes the popup.
  it("ignores a dismissed attempt that carries no token", () => {
    const { initialize } = installGoogleStub();
    const onCredential = vi.fn();

    renderGoogleButton({
      target: document.createElement("div"),
      clientId: "client-123",
      onCredential,
    });
    credentialCallback(initialize)({});

    expect(onCredential).not.toHaveBeenCalled();
  });

  it("does nothing when the script has not loaded yet", () => {
    expect(() =>
      renderGoogleButton({
        target: document.createElement("div"),
        clientId: "client-123",
        onCredential: vi.fn(),
      }),
    ).not.toThrow();
  });
});

describe("disableGoogleAutoSelect", () => {
  it("stops Google from signing the visitor back in after signing out", () => {
    const { disableAutoSelect } = installGoogleStub();

    disableGoogleAutoSelect();

    expect(disableAutoSelect).toHaveBeenCalled();
  });

  it("does nothing when the script never loaded", () => {
    expect(() => disableGoogleAutoSelect()).not.toThrow();
  });
});
