import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import GoogleSignInButton from "../GoogleSignInButton";

// Google's own script is never loaded here: the render call is injected, and the
// component is checked for what it asks for rather than what Google draws.
describe("GoogleSignInButton", () => {
  it("says what is missing when the client id is not configured", () => {
    render(
      <GoogleSignInButton
        clientId={undefined}
        onCredential={vi.fn()}
        renderButton={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set/),
    ).toBeInTheDocument();
  });

  it("does not try to render Google's button without a client id", () => {
    const renderButton = vi.fn();

    render(
      <GoogleSignInButton
        clientId={undefined}
        onCredential={vi.fn()}
        renderButton={renderButton}
      />,
    );

    expect(renderButton).not.toHaveBeenCalled();
  });

  it("renders Google's button into its own container once the script is ready", async () => {
    const renderButton = vi.fn();
    (globalThis as Record<string, unknown>).google = {
      accounts: { id: { initialize: vi.fn(), renderButton: vi.fn(), disableAutoSelect: vi.fn() } },
    };

    render(
      <GoogleSignInButton
        clientId="client-123"
        onCredential={vi.fn()}
        renderButton={renderButton}
      />,
    );

    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
    expect(renderButton.mock.calls[0][0]).toMatchObject({
      target: screen.getByTestId("google-signin-button"),
      clientId: "client-123",
    });
    delete (globalThis as Record<string, unknown>).google;
  });

  it("passes the credential handler straight through", async () => {
    const renderButton = vi.fn();
    const onCredential = vi.fn();
    (globalThis as Record<string, unknown>).google = {
      accounts: { id: { initialize: vi.fn(), renderButton: vi.fn(), disableAutoSelect: vi.fn() } },
    };

    render(
      <GoogleSignInButton
        clientId="client-123"
        onCredential={onCredential}
        renderButton={renderButton}
      />,
    );

    await waitFor(() => expect(renderButton).toHaveBeenCalled());
    expect(renderButton.mock.calls[0][0].onCredential).toBe(onCredential);
    delete (globalThis as Record<string, unknown>).google;
  });

  // Before the script has run there is nothing to render into: the component waits
  // for next/script's onLoad instead of failing.
  it("waits for the script before rendering the button", () => {
    const renderButton = vi.fn();

    render(
      <GoogleSignInButton
        clientId="client-123"
        onCredential={vi.fn()}
        renderButton={renderButton}
      />,
    );

    expect(renderButton).not.toHaveBeenCalled();
    expect(screen.getByTestId("google-signin-button")).toBeInTheDocument();
  });
});
