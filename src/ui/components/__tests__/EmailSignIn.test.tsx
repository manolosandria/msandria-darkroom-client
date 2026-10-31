import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@/src/domain/entities/User";
import { EmailSignInError } from "@/src/domain/errors/EmailSignInError";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import EmailSignIn, { EmailSignInPorts } from "../EmailSignIn";

const ana = new User({ id: "usr_1", email: "ana@example.com", role: "VIEWER" });

function show(ports: EmailSignInPorts) {
  const session: SessionPorts = {
    getCurrentUser: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
  render(
    <SessionProvider ports={session}>
      <EmailSignIn ports={ports} />
    </SessionProvider>,
  );
}

afterEach(() => window.history.replaceState(null, "", "/"));

describe("EmailSignIn", () => {
  it("asks for a link without saying whether the address has an account", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    show({ request, verify: vi.fn() });
    await userEvent.type(screen.getByLabelText("Email"), " ana@example.com ");
    await userEvent.click(
      screen.getByRole("button", { name: "Email me a link" }),
    );
    expect(request).toHaveBeenCalledWith("ana@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "If ana@example.com can receive email, a sign-in link is on its way.",
    );
  });

  it("explains when email sign-in is not available", async () => {
    show({
      request: vi.fn().mockRejectedValue(new EmailSignInError("unavailable")),
      verify: vi.fn(),
    });
    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: "Email me a link" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use Google instead",
    );
  });

  it("trades the link's token once and removes it from the address", async () => {
    window.history.replaceState(null, "", "/sign-in/email#token=abc");
    const verify = vi.fn().mockResolvedValue(ana);
    show({ request: vi.fn(), verify });
    expect(await screen.findByText("You are signed in.")).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith("abc");
    expect(window.location.hash).toBe("");
  });

  it("offers a new link when the one opened has expired", async () => {
    window.history.replaceState(null, "", "/sign-in/email#token=old");
    show({
      request: vi.fn(),
      verify: vi.fn().mockRejectedValue(new EmailSignInError("invalidLink")),
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This link has expired or was already used.",
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});
