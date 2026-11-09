import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  EditingWorkspace,
  saveFailureMessage,
  type SaveOutcome,
  useEditingWorkspace,
  usePendingEdits,
  useUnsavedEditor,
} from "../EditingWorkspace";

function Draft({ name, save }: { name: string; save: () => Promise<boolean> }) {
  const [value, setValue] = useState("");
  const { confirm } = useEditingWorkspace();
  useUnsavedEditor(Boolean(value), {
    label: name,
    save: async () => {
      const saved = await save();
      if (saved) setValue("");
      return saved;
    },
    discard: () => setValue(""),
  });
  return (
    <>
      <label>
        {name}
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button
        onClick={async () => {
          if (await confirm("Discard draft?", "Discard your edits?"))
            setValue("");
        }}
      >
        Discard {name}
      </button>
    </>
  );
}

function show(
  first = vi.fn().mockResolvedValue(true),
  second = vi.fn().mockResolvedValue(true),
) {
  const navigate = vi.fn();
  render(
    <EditingWorkspace navigate={navigate}>
      <Draft name="First draft" save={first} />
      <Draft name="Second draft" save={second} />
      <a href="/gallery">Leave editor</a>
    </EditingWorkspace>,
  );
  return { navigate, first, second };
}

describe("EditingWorkspace", () => {
  it("portals confirmations outside inert content and cancels on backdrop click", async () => {
    show();
    await userEvent.type(screen.getByLabelText("First draft"), "pending");
    await userEvent.click(screen.getByRole("button", { name: "Discard First draft" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.closest("[inert]")).toBeNull();
    await userEvent.click(screen.getByText("Discard your edits?"));
    expect(dialog).toBeInTheDocument();
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("First draft")).toHaveValue("pending");
    expect(screen.getByLabelText("First draft").closest("[inert]")).toBeNull();
  });

  it("keeps drafts when leaving is cancelled and guards a reload", async () => {
    const { navigate } = show();
    await userEvent.type(screen.getByLabelText("First draft"), "unsaved");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await userEvent.click(screen.getByRole("link", { name: "Leave editor" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Unsaved changes",
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("First draft")).toHaveValue("unsaved");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("saves all dirty editors explicitly before leaving", async () => {
    const { first, second, navigate } = show();
    await userEvent.type(screen.getByLabelText("First draft"), "one");
    await userEvent.type(screen.getByLabelText("Second draft"), "two");
    await userEvent.click(screen.getByRole("link", { name: "Leave editor" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Save all and leave" }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stays in the editor when saving fails and retains the failed draft", async () => {
    const { navigate } = show(vi.fn().mockResolvedValue(false));
    await userEvent.type(screen.getByLabelText("First draft"), "one");
    await userEvent.click(screen.getByRole("link", { name: "Leave editor" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Save all and leave" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "“First draft” was not saved. Its editor says why. Your drafts are still here. Cancel to fix it in its editor.",
    );
    expect(navigate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("First draft")).toHaveValue("one");
  });

  it("discards only on an explicit leave-without-saving choice", async () => {
    const { navigate, first } = show();
    await userEvent.type(screen.getByLabelText("First draft"), "one");
    await userEvent.click(screen.getByRole("link", { name: "Leave editor" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Leave without saving" }),
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("accepts confirmations with Enter and cancels with Escape", async () => {
    show();
    await userEvent.type(screen.getByLabelText("First draft"), "one");
    await userEvent.click(
      screen.getByRole("button", { name: "Discard First draft" }),
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByLabelText("First draft")).toHaveValue("one");
    await userEvent.click(
      screen.getByRole("button", { name: "Discard First draft" }),
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByLabelText("First draft")).toHaveValue(""),
    );
  });

  it("guards browser history navigation while a draft is dirty", async () => {
    const original = location.href;
    history.replaceState({}, "", "/curator");
    const { navigate } = show();
    await userEvent.type(screen.getByLabelText("First draft"), "one");
    history.replaceState({}, "", "/gallery");
    fireEvent(window, new PopStateEvent("popstate"));
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Unsaved changes",
    );
    expect(location.pathname).toBe("/curator");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(navigate).not.toHaveBeenCalled();
    history.replaceState({}, "", original);
  });
  it("registers a dirty editor once, however often it renders with new callbacks", async () => {
    const renders = vi.fn();
    function Bar() {
      const pending = usePendingEdits();
      renders(pending?.labels);
      return <p>{pending?.labels.join(", ")}</p>;
    }
    const save = vi.fn().mockResolvedValue(true);
    render(
      <EditingWorkspace>
        <Draft name="Only draft" save={save} />
        <Bar />
      </EditingWorkspace>,
    );
    await userEvent.type(screen.getByLabelText("Only draft"), "a");
    const settled = renders.mock.calls.length;
    await userEvent.type(screen.getByLabelText("Only draft"), "bcd");
    // Typing re-renders the editor with fresh callbacks; the list stays the same.
    expect(renders).toHaveBeenCalledTimes(settled);
    expect(screen.getByText("Only draft", { selector: "p" })).toBeInTheDocument();
  });

  it("says which editor, which fields and why a save failed, steadily while retrying", async () => {
    let settle: (outcome: SaveOutcome) => void = () => {};
    const save = vi
      .fn<() => Promise<SaveOutcome>>()
      .mockResolvedValueOnce({
        error: "The API rejected the photo: highlights must contain crops",
      })
      .mockImplementationOnce(
        () => new Promise<SaveOutcome>((resolve) => (settle = resolve)),
      );
    const navigate = vi.fn();
    function Titled() {
      const original = { title: "Araña", highlights: {} };
      const [draft, setDraft] = useState(original);
      useUnsavedEditor(draft.title !== original.title, {
        label: "Araña",
        save,
        discard: () => setDraft(original),
        document: { original, draft, restore: (value) => setDraft(value as typeof original) },
      });
      return (
        <input
          aria-label="Title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      );
    }
    render(
      <EditingWorkspace navigate={navigate}>
        <Titled />
        <a href="/gallery">Leave editor</a>
      </EditingWorkspace>,
    );
    await userEvent.type(screen.getByLabelText("Title"), "s");
    await userEvent.click(screen.getByRole("link", { name: "Leave editor" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Unsaved changes in “Araña”.");
    await userEvent.click(screen.getByRole("button", { name: "Save all and leave" }));
    const message =
      "“Araña” (Title) was not saved: The API rejected the photo: highlights must contain crops. Your drafts are still here. Cancel to fix it in its editor.";
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    // Trying again keeps the last failure on screen until the new outcome arrives.
    await userEvent.click(screen.getByRole("button", { name: "Save all and leave" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    settle(true);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  });
});

describe("saveFailureMessage", () => {
  it("names the editor and its fields, with or without a reason", () => {
    expect(saveFailureMessage("Home banner", [], "")).toBe(
      "“Home banner” was not saved. Its editor says why.",
    );
    expect(
      saveFailureMessage("Araña", ["Highlights", "Title"], "The session ended."),
    ).toBe("“Araña” (Highlights, Title) was not saved: The session ended.");
  });
});
