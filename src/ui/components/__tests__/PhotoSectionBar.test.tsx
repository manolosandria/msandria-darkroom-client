import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoSectionBar, SectionBarItem } from "../PhotoSectionBar";

const SECTIONS: SectionBarItem[] = [
  { id: "details", label: "Details", locked: true },
  { id: "frame", label: "Frame" },
  { id: "file", label: "File", badge: 2 },
];

function show(
  overrides: Partial<React.ComponentProps<typeof PhotoSectionBar>> = {},
) {
  const props = {
    sections: SECTIONS,
    current: "details",
    open: ["details"],
    hidden: [],
    onJump: vi.fn(),
    onExpandAll: vi.fn(),
    onCollapseAll: vi.fn(),
    onHiddenChange: vi.fn(),
    ...overrides,
  };
  render(<PhotoSectionBar {...props} />);
  return props;
}

describe("PhotoSectionBar", () => {
  it("jumps to a section, marks the current one and counts pending work", async () => {
    const user = userEvent.setup();
    const props = show();
    const nav = screen.getByRole("navigation", { name: "Photo sections" });
    expect(within(nav).getByRole("button", { name: "Details" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      within(nav).getByRole("button", { name: "File, 2 pending" }),
    ).toBeInTheDocument();
    await user.click(within(nav).getByRole("button", { name: "Frame" }));
    expect(props.onJump).toHaveBeenCalledWith("frame");
  });

  it("moves between section buttons with the arrow, Home and End keys", async () => {
    const user = userEvent.setup();
    show();
    const nav = screen.getByRole("navigation", { name: "Photo sections" });
    within(nav).getByRole("button", { name: "Details" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(within(nav).getByRole("button", { name: "Frame" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(within(nav).getByRole("button", { name: /File/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(within(nav).getByRole("button", { name: "Details" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(within(nav).getByRole("button", { name: /File/ })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(within(nav).getByRole("button", { name: "Details" })).toHaveFocus();
    await user.keyboard("a");
    expect(within(nav).getByRole("button", { name: "Details" })).toHaveFocus();
  });

  it("shows how many sections are open and disables what would change nothing", async () => {
    const user = userEvent.setup();
    const props = show({ open: [] });
    expect(screen.getByLabelText("0 of 3 sections open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Expand all" }));
    expect(props.onExpandAll).toHaveBeenCalled();
  });

  it("collapses everything and disables expanding once all are open", async () => {
    const user = userEvent.setup();
    const props = show({ open: ["details", "frame", "file"] });
    expect(screen.getByRole("button", { name: "Expand all" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(props.onCollapseAll).toHaveBeenCalled();
  });

  it("hides and shows sections from its menu, keeping the locked one", async () => {
    const user = userEvent.setup();
    const props = show();
    const button = screen.getByRole("button", { name: "Show or hide sections" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    const menu = screen.getByRole("group", { name: "Visible sections" });
    expect(within(menu).getByRole("checkbox", { name: /Details/ })).toBeDisabled();
    await user.click(within(menu).getByRole("checkbox", { name: /Frame/ }));
    expect(props.onHiddenChange).toHaveBeenCalledWith(["frame"]);
    expect(
      within(menu).getByRole("button", { name: "Show all sections" }),
    ).toBeDisabled();
  });

  it("lists hidden sections, warns of pending work among them and shows them again", async () => {
    const user = userEvent.setup();
    const props = show({ hidden: ["frame", "file"] });
    const nav = screen.getByRole("navigation", { name: "Photo sections" });
    expect(within(nav).queryByRole("button", { name: "Frame" })).not.toBeInTheDocument();
    expect(screen.getByText("2 hidden")).toHaveClass(
      "section-bar__hidden-count--alert",
    );
    await user.click(
      screen.getByRole("button", { name: "Show or hide sections, 2 hidden" }),
    );
    const menu = screen.getByRole("group", { name: "Visible sections" });
    await user.click(within(menu).getByRole("checkbox", { name: /File/ }));
    expect(props.onHiddenChange).toHaveBeenLastCalledWith(["frame"]);
    await user.click(within(menu).getByRole("button", { name: "Show all sections" }));
    expect(props.onHiddenChange).toHaveBeenLastCalledWith([]);
  });

  it("closes its menu with Escape, an outside press or focus moving away", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PhotoSectionBar
          sections={SECTIONS}
          current="details"
          open={[]}
          hidden={["frame"]}
          onJump={vi.fn()}
          onExpandAll={vi.fn()}
          onCollapseAll={vi.fn()}
          onHiddenChange={vi.fn()}
        />
        <button type="button">Elsewhere</button>
      </>,
    );
    const button = screen.getByRole("button", { name: /Show or hide sections/ });
    expect(screen.getByText("1 hidden")).not.toHaveClass(
      "section-bar__hidden-count--alert",
    );
    await user.click(button);
    await user.click(screen.getByRole("checkbox", { name: /Frame/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Visible sections" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByText("Show in the inspector"));
    expect(screen.getByRole("group", { name: "Visible sections" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("group", { name: "Visible sections" })).not.toBeInTheDocument();

    await user.click(button);
    await user.click(button);
    expect(screen.queryByRole("group", { name: "Visible sections" })).not.toBeInTheDocument();

    await user.click(button);
    screen.getByRole("checkbox", { name: /Frame/ }).focus();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.queryByRole("group", { name: "Visible sections" })).not.toBeInTheDocument();
  });

  it("lays out eight sections in two even rows and a few in one", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      id: `s${index}`,
      label: `Section ${index}`,
    }));
    const { unmount } = render(
      <PhotoSectionBar
        sections={many}
        current="s0"
        open={[]}
        hidden={["s7"]}
        onJump={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
        onHiddenChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("list").style.getPropertyValue("--section-columns")).toBe("4");
    unmount();
    show();
    expect(screen.getByRole("list").style.getPropertyValue("--section-columns")).toBe("3");
  });
});
