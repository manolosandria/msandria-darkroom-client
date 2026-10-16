import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicName } from "@/src/domain/entities/PublicName";
import { User } from "@/src/domain/entities/User";
import { PublicNameError } from "@/src/domain/errors/PublicNameError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { updatePublicName } from "@/src/infrastructure/sessionServices";
import { PublicNameSettings } from "../PublicNameSettings";

vi.mock("@/src/infrastructure/sessionServices", () => ({
  updatePublicName: { execute: vi.fn() },
}));

const fullChoices: PublicName = {
  style: "GIVEN_NAME_INITIAL",
  alias: null,
  choices: { GIVEN_NAME_INITIAL: "Ana G.", FULL_NAME: "Ana García" },
  current: "Ana G.",
};

const savedUser = new User({ id: "usr_1", email: "ana@example.com", role: "VIEWER" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updatePublicName.execute).mockResolvedValue(savedUser);
});

describe("PublicNameSettings", () => {
  it("offers the forms the account has, plus an alias, with the chosen one selected", () => {
    render(<PublicNameSettings publicName={fullChoices} onSaved={vi.fn()} />);

    expect(screen.getByRole("radio", { name: /First name and initial/ })).toBeChecked();
    expect(screen.getByText("Ana G.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Full name from Google/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /alias of your own/ })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Alias" })).not.toBeInTheDocument();
  });

  it("leaves out a form the API could not build and selects what it would use", () => {
    render(
      <PublicNameSettings
        publicName={{ ...fullChoices, choices: { FULL_NAME: "Ana García" }, current: "Ana García" }}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.queryByRole("radio", { name: /First name and initial/ })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Full name from Google/ })).toBeChecked();
  });

  it("falls back to an alias when nothing else can be built", () => {
    render(
      <PublicNameSettings
        publicName={{ ...fullChoices, choices: {}, current: null }}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: /alias of your own/ })).toBeChecked();
  });

  it("saves an alias trimmed and hands back the updated account", async () => {
    const onSaved = vi.fn();
    render(<PublicNameSettings publicName={fullChoices} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("radio", { name: /alias of your own/ }));
    await userEvent.type(screen.getByRole("textbox", { name: "Alias" }), "  Slow Lens ");
    await userEvent.click(screen.getByRole("button", { name: "Save public name" }));

    expect(updatePublicName.execute).toHaveBeenCalledWith("ALIAS", "Slow Lens");
    expect(onSaved).toHaveBeenCalledWith(savedUser);
    expect(await screen.findByRole("status")).toHaveTextContent("Public name saved.");
  });

  it("clears an empty alias when another form is chosen", async () => {
    render(<PublicNameSettings publicName={fullChoices} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole("radio", { name: /Full name from Google/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save public name" }));

    expect(updatePublicName.execute).toHaveBeenCalledWith("FULL_NAME", null);
  });

  it("keeps a stored alias when another form is chosen", async () => {
    render(
      <PublicNameSettings
        publicName={{ ...fullChoices, alias: "Slow Lens" }}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save public name" }));

    expect(updatePublicName.execute).toHaveBeenCalledWith("GIVEN_NAME_INITIAL", "Slow Lens");
  });

  it.each([
    [new PublicNameError(), "cannot include links"],
    [new RateLimitError(), "Please wait"],
    [new Error("down"), "Could not save your public name"],
  ])("explains a refusal (%s)", async (failure, message) => {
    vi.mocked(updatePublicName.execute).mockRejectedValue(failure);
    const onSaved = vi.fn();
    render(<PublicNameSettings publicName={fullChoices} onSaved={onSaved} />);

    await userEvent.click(screen.getByRole("button", { name: "Save public name" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
