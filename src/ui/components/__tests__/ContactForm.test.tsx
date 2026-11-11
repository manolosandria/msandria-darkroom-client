import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { User } from "@/src/domain/entities/User";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { manageContact } from "@/src/infrastructure/contactServices";
import { SessionPorts } from "@/src/ui/hooks/useSession";
import { SessionProvider } from "../SessionProvider";
import ContactForm from "../ContactForm";

vi.mock("@/src/infrastructure/contactServices", () => ({
  manageContact: { send: vi.fn(), confirm: vi.fn() },
}));

async function fill({ email = true } = {}) {
  await userEvent.type(screen.getByLabelText("Your name"), "Ana");
  if (email)
    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
  await userEvent.type(screen.getByLabelText("Message"), "I would like a print.");
  await userEvent.click(screen.getByLabelText(/I agree/));
}

const send = () =>
  userEvent.click(screen.getByRole("button", { name: /Send message/ }));

const pending = {
  status: "pending" as const,
  verificationId: "pend_1",
  expiresAt: "2026-11-11T12:10:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

describe("ContactForm", () => {
  it("uses English validation messages instead of browser-localized tooltips", async () => {
    render(<ContactForm />);
    await send();
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter your name");
    await userEvent.type(screen.getByLabelText("Your name"), "Ana");
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await send();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(manageContact.send).not.toHaveBeenCalled();
  });

  it("signed out, asks for the emailed code before the message reaches the inbox", async () => {
    vi.mocked(manageContact.send).mockResolvedValue(pending);
    vi.mocked(manageContact.confirm).mockResolvedValue();
    render(<ContactForm />);
    await fill();
    await send();

    expect(manageContact.send).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@example.com",
      body: "I would like a print.",
      consent: true,
      website: "",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "We sent a 6-digit code to ana@example.com",
    );
    const confirm = screen.getByRole("button", { name: /Confirm and send/ });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("6-digit code"), "012345");
    await userEvent.click(confirm);

    expect(manageContact.confirm).toHaveBeenCalledWith("pend_1", "012345");
    expect(await screen.findByRole("status")).toHaveTextContent(/inbox/);
  });

  it("keeps the code step on a wrong code and can go back to the message", async () => {
    vi.mocked(manageContact.send).mockResolvedValue(pending);
    vi.mocked(manageContact.confirm).mockRejectedValue(
      new Error("That code is wrong or has expired."),
    );
    render(<ContactForm />);
    await fill();
    await send();
    await userEvent.type(await screen.findByLabelText("6-digit code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /Confirm and send/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("wrong or has expired");

    await userEvent.click(
      screen.getByRole("button", { name: "Edit the message or the email" }),
    );
    expect(screen.getByLabelText("Message")).toHaveValue("I would like a print.");
  });

  it("explains a rate limit on the code", async () => {
    vi.mocked(manageContact.send).mockResolvedValue(pending);
    vi.mocked(manageContact.confirm).mockRejectedValue(new RateLimitError(60));
    render(<ContactForm />);
    await fill();
    await send();
    await userEvent.type(await screen.findByLabelText("6-digit code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: /Confirm and send/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("signed in, signs with the account's email and sends at once", async () => {
    vi.mocked(manageContact.send).mockResolvedValue({ status: "received" });
    const session: SessionPorts = {
      getCurrentUser: vi.fn().mockResolvedValue(
        new User({ id: "u1", email: "member@example.com", role: "VIEWER" }),
      ),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
    render(
      <SessionProvider ports={session}>
        <ContactForm />
      </SessionProvider>,
    );
    expect(await screen.findByDisplayValue("member@example.com")).toHaveAttribute(
      "readonly",
    );
    await fill({ email: false });
    await send();

    expect(manageContact.send).toHaveBeenCalledWith(
      expect.objectContaining({ email: "member@example.com" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/inbox/);
    expect(manageContact.confirm).not.toHaveBeenCalled();
  });

  it("hides the trap field from people and assistive technology", () => {
    render(<ContactForm />);
    const trap = document.querySelector('input[name="website"]');
    expect(trap).toHaveAttribute("aria-hidden", "true");
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap).toHaveClass("contact-trap");
  });

  it("keeps the message when sending fails", async () => {
    vi.mocked(manageContact.send).mockRejectedValue(new RateLimitError(60));
    render(<ContactForm />);
    await fill();
    await send();

    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a minute/);
    expect(screen.getByLabelText("Message")).toHaveValue("I would like a print.");
  });
});
