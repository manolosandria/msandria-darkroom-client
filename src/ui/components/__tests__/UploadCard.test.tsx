import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { UploadCard, UploadItem } from "../UploadPanel";

const item: UploadItem = {
  id: 1,
  file: new File(["x"], "fog.jpg", { type: "image/jpeg" }),
  preview: "blob:fog",
  title: "Fog",
  description: "",
  highlights: {},
  frame: null,
  trim: null,
  status: "draft",
  classification: {
    visibility: "POSTS_ONLY",
    categoryNames: [],
    collections: [],
  },
};

function card(slot?: HTMLElement) {
  return render(
    <UploadCard
      item={item}
      index={0}
      forPost
      running={false}
      previewSlot={slot}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      onUpload={vi.fn()}
    />,
  );
}

function wide(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query }));
}

describe("A post's upload card", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows its photograph beside it on a wide screen", () => {
    wide(true);
    const slot = document.createElement("div");
    document.body.append(slot);
    card(slot);
    const preview = within(slot).getByAltText("Fog");
    expect(preview).toBeInTheDocument();
    expect(
      screen.getByRole("article").querySelector(".upload-photo-surface"),
    ).toBeNull();
    slot.remove();
  });

  it("keeps its photograph inside on a narrower screen, and a click expands it", () => {
    wide(false);
    const slot = document.createElement("div");
    card(slot);
    expect(slot).toBeEmptyDOMElement();
    const article = screen.getByRole("article");
    const photo = article.querySelector(".upload-preview") as HTMLElement;
    fireEvent.click(photo);
    expect(article).toHaveAttribute("data-expanded", "true");
    expect(
      screen.getByRole("button", { name: /Compact view/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(photo);
    expect(article).not.toHaveAttribute("data-expanded");
  });

  it("asks only for what a post needs until More options", () => {
    card();
    expect(screen.getByLabelText("Title")).toHaveValue("Fog");
    expect(screen.getByRole("radio", { name: "Only in posts" })).toBeChecked();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /More options/ }));
    expect(screen.getByRole("tablist", { name: "Photo preparation" })).toBeInTheDocument();
  });
});
