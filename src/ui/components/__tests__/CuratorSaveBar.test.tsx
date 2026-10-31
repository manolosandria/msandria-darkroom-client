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

function Bars({ children }: { children: React.ReactNode }) {
  const state = useCuratorSaveBar();
  return (
    <>
      <CuratorSaveBar edge="top" state={state} />
      {children}
      <CuratorSaveBar edge="bottom" state={state} />
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
  it("appears above and below only while something is unsaved, and saves it all", async () => {
    const save = vi.fn().mockResolvedValue(true);
    show(save);
    expect(screen.queryByRole("region", { name: /Save changes/ })).toBeNull();

    await userEvent.type(screen.getByLabelText("Home banner"), "x");
    const bars = screen.getAllByRole("region", { name: /Save changes/ });
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveTextContent("Unsaved: Home banner");
    await userEvent.type(screen.getByLabelText("Gallery design"), "y");
    expect(bars[1]).toHaveTextContent(
      "2 editors unsaved: Home banner, Gallery design",
    );

    await userEvent.click(within(bars[1]).getByRole("button", { name: "Save all" }));
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
    expect(
      (await screen.findAllByRole("alert"))[0],
    ).toHaveTextContent(/could not be saved/);
    expect(screen.getByLabelText("Home banner")).toHaveValue("x");
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

  it("folds into a tab that brings it back, remembered per visitor", async () => {
    show();
    await userEvent.type(screen.getByLabelText("Home banner"), "x");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Hide the save buttons" })[0],
    );
    expect(screen.queryByRole("region", { name: /Save changes/ })).toBeNull();
    expect(localStorage.getItem("curatorSaveBarHidden")).toBe("true");
    const tabs = screen.getAllByRole("button", { name: /Show save buttons/ });
    expect(tabs).toHaveLength(2);
    await userEvent.click(tabs[1]);
    expect(screen.getAllByRole("region", { name: /Save changes/ })).toHaveLength(
      2,
    );
  });
});
