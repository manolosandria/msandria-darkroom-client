import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { manageContact } from "@/src/infrastructure/contactServices";
import ContactForm from "../ContactForm";

vi.mock("@/src/infrastructure/contactServices", () => ({
  manageContact: { send: vi.fn() },
}));

async function fill() {
  await userEvent.type(screen.getByLabelText("Your name"), "Ana");
  await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
  await userEvent.type(screen.getByLabelText("Message"), "I would like a print.");
  await userEvent.click(screen.getByLabelText(/I agree/));
}

beforeEach(() => vi.clearAllMocks());

describe("ContactForm", () => {
  it("uses English validation messages instead of browser-localized tooltips", async () => {
    render(<ContactForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter your name");
    await userEvent.type(screen.getByLabelText("Your name"), "Ana");
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(manageContact.send).not.toHaveBeenCalled();
  });
  it("sends the message with consent and thanks the visitor", async () => {
    vi.mocked(manageContact.send).mockResolvedValue();
    render(<ContactForm />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(manageContact.send).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@example.com",
      body: "I would like a print.",
      consent: true,
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/inbox/);
  });

  it("keeps the message when sending fails", async () => {
    vi.mocked(manageContact.send).mockRejectedValue(new RateLimitError(60));
    render(<ContactForm />);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a minute/);
    expect(screen.getByLabelText("Message")).toHaveValue("I would like a print.");
  });
});
