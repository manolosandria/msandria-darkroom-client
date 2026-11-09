import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditingWorkspace, useUnsavedEditor } from "../EditingWorkspace";
import { CuratorSaveBar, useCuratorSaveBar } from "../CuratorSaveBar";

vi.mock("next/navigation", () => ({ usePathname: () => "/curator" }));

function Editor({
  label,
  save = () => Promise.resolve(true),
}: {
  label: string;
  save?: () => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  useUnsavedEditor(Boolean(value), {
    label,
    save: async () => {
      const saved = await save();
      if (saved) setValue("");
      return saved;
    },
    discard: () => setValue(""),
  });
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

// An editor that says what it edits, so its changes can be undone and reviewed.
function DocumentEditor({ onSave }: { onSave: (value: unknown) => void }) {
  const original = { title: "Night", color: "#000000" };
  const [draft, setDraft] = useState(original);
  useUnsavedEditor(JSON.stringify(draft) !== JSON.stringify(original), {
    label: "Poster",
    save: async () => {
      onSave(draft);
      return true;
    },
    discard: () => setDraft(original),
    document: {
      original,
      draft,
      restore: (value) => setDraft(value as typeof original),
    },
  });
  return (
    <>
      <input
        aria-label="Title"
        value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
      />
      <button type="button" onClick={() => setDraft({ ...draft, color: "#00897b" })}>
        Teal
      </button>
      <button type="button" onClick={() => setDraft({ ...draft, color: "#c2185b" })}>
        Rose
      </button>
      <output data-testid="color">{draft.color}</output>
    </>
  );
}

function Bars({ children }: { children: React.ReactNode }) {
  const state = useCuratorSaveBar();
  return (
    <>
      {children}
      <CuratorSaveBar state={state} />
    </>
  );
}

function show(save?: () => Promise<boolean>) {
  render(
    <EditingWorkspace>
      <Bars>
        <Editor label="Home banner" save={save} />
        <Editor label="Gallery design" />
      </Bars>
    </EditingWorkspace>,
  );
}

beforeEach(() => localStorage.clear());

describe("CuratorSaveBar", () => {
  it("appears in its corner only while something is unsaved, and saves it all", async () => {
    const save = vi.fn().mockResolvedValue(true);
    show(save);
    expect(screen.queryByRole("region", { name: /Save changes/ })).toBeNull();

    await userEvent.type(screen.getByLabelText("Home banner"), "x");
    const bar = screen.getByRole("region", { name: "Save changes" });
    expect(bar).toHaveTextContent("Unsaved: Home banner");
    await userEvent.type(screen.getByLabelText("Gallery design"), "y");
    expect(bar).toHaveTextContent(
      "2 editors unsaved: Home banner, Gallery design",
    );

    await userEvent.click(within(bar).getByRole("button", { name: "Save all" }));
    const review = await screen.findByRole("dialog", { name: "Review changes" });
    expect(within(review).getByRole("region", { name: "Home banner" })).toBeInTheDocument();
    await userEvent.click(within(review).getByRole("button", { name: "Save all" }));
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: /Save changes/ })).toBeNull(),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps the drafts and says so when a save fails", async () => {
    show(vi.fn().mockResolvedValue(false));
    await userEvent.type(screen.getByLabelText("Home banner"), "x");
    await userEvent.click(
      within(screen.getAllByRole("region")[0]).getByRole("button", {
        name: "Save",
      }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Save all",
      }),
    );
    expect(
      (await screen.findAllByRole("alert"))[0],
    ).toHaveTextContent(
      "“Home banner” was not saved. Its editor says why. Your drafts are still here.",
    );
    expect(screen.getByLabelText("Home banner")).toHaveValue("x");
  });

  it("reviews each change before saving and keeps only the accepted ones", async () => {
    const saved = vi.fn();
    render(
      <EditingWorkspace>
        <Bars>
          <DocumentEditor onSave={saved} />
        </Bars>
      </EditingWorkspace>,
    );
    await userEvent.type(screen.getByLabelText("Title"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Teal" }));
    await userEvent.click(
      within(screen.getByRole("region", { name: "Save changes" })).getByRole(
        "button",
        { name: "Save" },
      ),
    );
    const review = await screen.findByRole("dialog", { name: "Review changes" });
    expect(review).toHaveTextContent("Night");
    expect(review).toHaveTextContent("Night!");
    await userEvent.click(
      within(
        within(review).getByRole("radiogroup", { name: "Keep or discard: Color" }),
      ).getByRole("radio", { name: "Discard" }),
    );
    await userEvent.click(within(review).getByRole("button", { name: "Save 1 of 2" }));
    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith({ title: "Night!", color: "#000000" }),
    );
  });

  it("takes back changes one step at a time, from the bar or with Ctrl+Z", async () => {
    render(
      <EditingWorkspace>
        <Bars>
          <DocumentEditor onSave={vi.fn()} />
        </Bars>
      </EditingWorkspace>,
    );
    // Changes to one field close together are one step (typing, dragging); these two
    // choices come seconds apart.
    let now = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => (now += 5000));
    await userEvent.click(screen.getByRole("button", { name: "Teal" }));
    await userEvent.click(screen.getByRole("button", { name: "Rose" }));
    clock.mockRestore();
    expect(screen.getByTestId("color")).toHaveTextContent("#c2185b");
    await userEvent.click(
      screen.getByRole("button", { name: "Undo the last change in Poster" }),
    );
    expect(screen.getByTestId("color")).toHaveTextContent("#00897b");
    // Outside a text field, Ctrl+Z does the same.
    screen.getByRole("button", { name: "Rose" }).focus();
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(screen.getByTestId("color")).toHaveTextContent("#000000");
    expect(screen.queryByRole("region", { name: "Save changes" })).toBeNull();
  });

  it("cancels every draft after confirming", async () => {
    show();
    await userEvent.type(screen.getByLabelText("Home banner"), "x");
    await userEvent.click(
      within(screen.getAllByRole("region")[0]).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(
      screen.getByRole("dialog", { name: "Discard all changes?" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(screen.getByLabelText("Home banner")).toHaveValue("");
  });

  it("folds into a corner button that brings it back, remembered per visitor", async () => {
    show();
    await userEvent.type(screen.getByLabelText("Home banner"), "x");
    await userEvent.click(
      screen.getByRole("button", { name: "Hide the save buttons" }),
    );
    expect(screen.queryByRole("region", { name: /Save changes/ })).toBeNull();
    expect(localStorage.getItem("curatorSaveBarHidden")).toBe("true");
    await userEvent.click(
      screen.getByRole("button", {
        name: "Show save buttons. Unsaved: Home banner",
      }),
    );
    expect(screen.getByRole("region", { name: "Save changes" })).toBeVisible();
  });
});
