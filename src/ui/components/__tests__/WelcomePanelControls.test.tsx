import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { WelcomePanelControls } from "../BannerLayoutPicker";
import { defaultWelcomePanel } from "@/src/domain/entities/HomeBanner";

describe("Welcome panel controls", () => {
  it("marks no anchor while the panel is placed freely, and an anchor snaps it back", () => {
    const onChange = vi.fn();
    render(
      <WelcomePanelControls
        welcome={{ ...defaultWelcomePanel, x: 20, y: 30 }}
        opacity={45}
        onChange={onChange}
        onOpacityChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Placed freely/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("radiogroup", { name: "Welcome position" }))
        .getAllByRole("radio")
        .filter((radio) => radio.getAttribute("aria-checked") === "true"),
    ).toHaveLength(0);
    fireEvent.click(screen.getByRole("radio", { name: "Top right" }));
    expect(onChange).toHaveBeenCalledWith({
      ...defaultWelcomePanel,
      position: "top-right",
      x: undefined,
      y: undefined,
    });
  });
});
