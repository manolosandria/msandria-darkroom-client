import { expect } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

/** Picks an option of a ChoiceMenu, as changing a native select did. */
export function choose(menu: HTMLElement, name: string | RegExp) {
  if (menu.getAttribute("aria-expanded") !== "true") fireEvent.click(menu);
  fireEvent.click(screen.getByRole("option", { name }));
}

/** Opens the menu, waits until the option can be picked (data still loading), picks it. */
export async function chooseWhenReady(
  menu: HTMLElement,
  name: string | RegExp,
) {
  if (menu.getAttribute("aria-expanded") !== "true") fireEvent.click(menu);
  await waitFor(() =>
    expect(screen.getByRole("option", { name })).not.toHaveAttribute(
      "aria-disabled",
    ),
  );
  fireEvent.click(screen.getByRole("option", { name }));
}
