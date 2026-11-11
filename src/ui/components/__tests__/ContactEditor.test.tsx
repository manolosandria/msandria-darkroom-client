import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultContactSettings } from "@/src/domain/entities/ContactSettings";
import { manageContactSettings } from "@/src/infrastructure/contactSettingsServices";
import ContactEditor from "../ContactEditor";
import ContactForm from "../ContactForm";
vi.mock("@/src/infrastructure/contactSettingsServices", () => ({
  manageContactSettings: { get: vi.fn(), save: vi.fn() },
}));
vi.mock("../EditingWorkspace", () => ({
  useEditingWorkspace: () => ({ confirm: async () => true }),
  useUnsavedEditor: (
    _dirty: boolean,
    editor: { save: () => Promise<boolean> },
  ) => ({ review: () => editor.save() }),
}));
beforeEach(() => {
  vi.mocked(manageContactSettings.get).mockResolvedValue(
    defaultContactSettings,
  );
  vi.mocked(manageContactSettings.save).mockImplementation(async (draft) => ({
    ...draft,
    version: 2,
  }));
});
it("previews appearance, saves with version and keeps failed drafts", async () => {
  const user = userEvent.setup();
  render(<ContactEditor />);
  await waitFor(() => expect(screen.getByLabelText("Title")).toBeEnabled());
  await user.clear(screen.getByLabelText("Title"));
  await user.type(screen.getByLabelText("Title"), "Say hello");
  await user.selectOptions(screen.getByLabelText("Layout"), "stacked");
  fireEvent.change(screen.getByLabelText("background color"), {
    target: { value: "#112233" },
  });
  expect(
    screen.getByRole("heading", { name: "Say hello" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  vi.mocked(manageContactSettings.save).mockRejectedValueOnce(
    new Error("Conflict: reload"),
  );
  await user.click(screen.getByRole("button", { name: "Save Contact" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Conflict");
  expect(screen.getByLabelText("Title")).toHaveValue("Say hello");
  await user.click(screen.getByRole("button", { name: "Save Contact" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Contact settings saved",
  );
  expect(manageContactSettings.save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      version: 1,
      title: "Say hello",
      layout: "stacked",
      background: "#112233",
    }),
  );
});
it("loads the saved appearance on the public form while keeping consent", async () => {
  vi.mocked(manageContactSettings.get).mockResolvedValue({
    ...defaultContactSettings,
    title: "Welcome",
    showFacts: false,
  });
  render(<ContactForm />);
  expect(
    await screen.findByRole("heading", { name: "Welcome" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /I agree/ })).toBeRequired();
  expect(screen.queryByText("Only the photographer reads it.")).toBeNull();
});
