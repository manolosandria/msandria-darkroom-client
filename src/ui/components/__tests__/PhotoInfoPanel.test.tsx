import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoInfoPanel } from "../PhotoInfoPanel";
import { ViewerVariants } from "../ViewerVariants";

vi.mock("../PhotoComments", () => ({ PhotoComments: () => null }));
vi.mock("../PhotoReactions", () => ({ PhotoReactions: () => null }));
vi.mock("@/src/infrastructure/catalogServices", () => ({
  editCatalog: {
    load: vi.fn().mockResolvedValue({
      works: [
        { id: "w", title: "Two", variants: [{ photoId: "a" }, { photoId: "b" }] },
      ],
    }),
  },
}));
vi.mock("@/src/infrastructure/photoServices", () => ({
  getPhotoById: { execute: vi.fn() },
}));

const shot = (id: string, extra: Partial<ConstructorParameters<typeof Photo>[0]> = {}) =>
  new Photo({
    id,
    title: `Photo ${id}`,
    width: 1600,
    height: 1000,
    renditions: [{ width: 640, url: `https://cdn/${id}.jpg` }],
    ...extra,
  });

describe("PhotoInfoPanel highlights", () => {
  it("shows each highlight and opens the chosen one large", async () => {
    render(
      <PhotoInfoPanel
        photo={shot("a", {
          highlights: {
            square: { x: 0, y: 0, width: 0.5, height: 0.8 },
            custom: [
              { id: "sky", name: "Sky", crop: { x: 0, y: 0, width: 1, height: 0.3 } },
            ],
          },
        })}
        onClose={() => {}}
      />,
    );
    const section = screen.getByRole("region", { name: "Highlights" });
    expect(within(section).getByText("Square")).toBeInTheDocument();
    expect(within(section).getByText("Sky")).toBeInTheDocument();
    const sky = within(section).getByRole("button", { name: "Show the Sky highlight" });
    await userEvent.click(sky);
    expect(sky).toHaveAttribute("aria-pressed", "true");
    expect(within(section).getByRole("figure")).toHaveTextContent("Sky");
    await userEvent.click(sky);
    expect(within(section).queryByRole("figure")).not.toBeInTheDocument();
  });

  it("leaves the section out when the photo has no highlights", () => {
    render(<PhotoInfoPanel photo={shot("a")} onClose={() => {}} />);
    expect(screen.queryByRole("region", { name: "Highlights" })).not.toBeInTheDocument();
  });
});

describe("ViewerVariants", () => {
  const photos = [shot("a"), shot("b")];

  it("sits in the corner the photo chose", async () => {
    render(<ViewerVariants photoId="a" photos={photos} position="TOP_RIGHT" />);
    expect(
      await screen.findByRole("navigation", { name: "Photograph variants" }),
    ).toHaveAttribute("data-corner", "top-right");
  });

  it("stays centred at the bottom without a corner", async () => {
    render(<ViewerVariants photoId="a" photos={photos} />);
    expect(
      await screen.findByRole("navigation", { name: "Photograph variants" }),
    ).toHaveAttribute("data-corner", "bottom-center");
  });
});
