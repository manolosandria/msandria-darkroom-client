import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CuratorDashboard from "../CuratorDashboard";

vi.mock("@/src/infrastructure/contactServices", () => ({
  manageContact: { dashboard: vi.fn() },
}));

const summary = {
  comments: 2,
  inbox: 0,
  unoptimizedPhotos: 1,
  storageTasks: 0,
  photos: 40,
  accounts: 9,
};

describe("CuratorDashboard", () => {
  it("shows what waits and opens the tab where it is dealt with", async () => {
    const onOpen = vi.fn();
    const load = vi.fn().mockResolvedValue(summary);
    render(<CuratorDashboard onOpen={onOpen} load={load} />);

    const comments = await screen.findByRole("button", {
      name: /^2s*Comments to moderate/,
    });
    expect(comments.closest("li")).toHaveClass("is-pending");
    expect(
      screen.getByRole("button", { name: /^0s*Unread messages/ }).closest("li"),
    ).not.toHaveClass("is-pending");
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    await userEvent.click(comments);
    expect(onOpen).toHaveBeenCalledWith("Comments");
    await userEvent.click(
      screen.getByRole("button", { name: /^1s*Photos to re-export/ }),
    );
    expect(onOpen).toHaveBeenLastCalledWith("Photos");

    load.mockRejectedValueOnce(new Error("Sign in as the administrator."));
    await act(async () => {
      window.dispatchEvent(new Event("curator:refresh"));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Sign in");
  });
});
