import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@/src/domain/entities/User";
import { EmailSignInError } from "@/src/domain/errors/EmailSignInError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
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

async function askForCode() {
  await userEvent.type(screen.getByLabelText("Email"), " ana@example.com ");
  await userEvent.click(screen.getByRole("button", { name: "Email me a code" }));
}

describe("EmailSignIn", () => {
  it("asks for a code without saying whether the address has an account", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    show({ request, verify: vi.fn() });
    await askForCode();
    expect(request).toHaveBeenCalledWith("ana@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "If ana@example.com can receive email, a 6-digit code is on its way.",
    );
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
  });

  it("signs in with the code typed in the same window", async () => {
    const verify = vi.fn().mockResolvedValue(ana);
    show({ request: vi.fn().mockResolvedValue(undefined), verify });
    await askForCode();
    const field = await screen.findByLabelText("6-digit code");
    const submit = screen.getByRole("button", { name: "Sign in" });
    expect(submit).toBeDisabled();
    await userEvent.type(field, "01 23-45x9");
    expect(field).toHaveValue("012345");
    await userEvent.click(submit);
    expect(verify).toHaveBeenCalledWith("ana@example.com", "012345");
    expect(await screen.findByText("You are signed in.")).toBeInTheDocument();
  });

  it("keeps the code form when the code is wrong", async () => {
    show({
      request: vi.fn().mockResolvedValue(undefined),
      verify: vi.fn().mockRejectedValue(new EmailSignInError("invalidCode")),
    });
    await askForCode();
    await userEvent.type(await screen.findByLabelText("6-digit code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code is wrong or has expired.",
    );
    expect(screen.getByLabelText("6-digit code")).toHaveValue("000000");
  });

  it("sends a new code or goes back to change the address", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    show({ request, verify: vi.fn() });
    await askForCode();
    await userEvent.click(
      await screen.findByRole("button", { name: "Send a new code" }),
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "A new code is on its way to ana@example.com",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Use a different email" }),
    );
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });

  it("explains a refused new code without leaving the code form", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new RateLimitError(60));
    show({ request, verify: vi.fn() });
    await askForCode();
    await userEvent.click(
      await screen.findByRole("button", { name: "Send a new code" }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
  });

  it("explains when email sign-in is not available", async () => {
    show({
      request: vi.fn().mockRejectedValue(new EmailSignInError("unavailable")),
      verify: vi.fn(),
    });
    await askForCode();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use Google instead",
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});
