import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DeviceFrame, DeviceSwitch } from "../DeviceSwitch";

it("offers desktop and phone as radios, switched by a click or the arrow keys", () => {
  const onChange = vi.fn();
  render(<DeviceSwitch value="desktop" onChange={onChange} tone="dark" />);
  const group = screen.getByRole("radiogroup", { name: "Preview device" });
  expect(group).toHaveAttribute("data-tone", "dark");
  expect(screen.getByRole("radio", { name: /Desktop/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /Phone/ })).toHaveAttribute(
    "tabindex",
    "-1",
  );
  fireEvent.click(screen.getByRole("radio", { name: /Phone/ }));
  expect(onChange).toHaveBeenLastCalledWith("mobile");
  fireEvent.keyDown(group, { key: "ArrowRight" });
  expect(onChange).toHaveBeenLastCalledWith("mobile");
  onChange.mockClear();
  fireEvent.keyDown(group, { key: "Enter" });
  expect(onChange).not.toHaveBeenCalled();
});

it("draws the preview inside the chosen device", () => {
  render(
    <DeviceFrame device="mobile" className="extra">
      <p>Inside</p>
    </DeviceFrame>,
  );
  expect(screen.getByText("Inside").parentElement).toHaveClass(
    "device-frame",
    "device-frame--mobile",
    "extra",
  );
});
