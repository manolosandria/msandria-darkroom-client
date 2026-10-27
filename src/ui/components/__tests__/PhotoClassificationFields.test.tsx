import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClassificationCatalogBoundary } from "../ClassificationCatalog";
import userEvent from "@testing-library/user-event";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import {
  PhotoClassification,
  PhotoClassificationFields,
  publicClassification,
} from "../PhotoClassificationFields";

vi.mock("@/src/infrastructure/catalogServices", () => ({
  manageCatalog: { load: vi.fn() },
}));

const catalog = {
  categories: [{ id: "cat", name: "Street" }],
  collections: [
    {
      id: "col",
      title: "City",
      categories: [],
      entries: [{ photoId: "a", columns: 1, rows: 1 }],
    },
  ],
  works: [],
  photos: [],
};

const changes = vi.fn<(value: PhotoClassification) => void>();
const latest = () => changes.mock.lastCall?.[0];
function Harness() {
  const [value, setValue] = useState(publicClassification());
  return (
    <PhotoClassificationFields
      value={value}
      onChange={(next) => {
        changes(next);
        setValue(next);
      }}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(manageCatalog.load).mockResolvedValue(catalog);
});

describe("PhotoClassificationFields", () => {
  it("shares suggestions across cards and reloads once after a catalog change", async () => {
    render(<ClassificationCatalogBoundary><Harness /><Harness /><Harness /></ClassificationCatalogBoundary>);
    await screen.findAllByRole("option", { name: "City" });
    expect(manageCatalog.load).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event("curator:catalog-changed"));
    await waitFor(() => expect(manageCatalog.load).toHaveBeenCalledTimes(2));
  });
  it("starts public", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Visibility")).toHaveValue("PUBLIC");
  });

  it("closes a category with a comma and reuses the existing spelling", async () => {
    render(<Harness />);
    await screen.findByRole("option", { name: "City" });
    await userEvent.type(screen.getByLabelText("Categories"), "street,Night,");

    expect(latest()?.categoryNames).toEqual(["Street", "Night"]);
    expect(screen.getByLabelText("Categories")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Remove category Night" }));
    expect(latest()?.categoryNames).toEqual(["Street"]);
  });

  it("adds a collection at its end and lets the order change", async () => {
    render(<Harness />);
    await userEvent.selectOptions(
      screen.getByLabelText("Add to collections"),
      await screen.findByRole("option", { name: "City" }),
    );

    expect(latest()?.collections).toEqual([{ id: "col", position: 2 }]);
    const order = screen.getByLabelText("Order");
    await userEvent.clear(order);
    await userEvent.type(order, "1");
    expect(latest()?.collections).toEqual([{ id: "col", position: 1 }]);
    await userEvent.click(screen.getByRole("button", { name: "Remove from collection" }));
    expect(latest()?.collections).toEqual([]);
  });

  it("explains a collections-only photo", async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText("Visibility"), "COLLECTIONS_ONLY");
    expect(screen.getByText(/hidden from the general gallery/)).toBeInTheDocument();
  });

  it("offers a retry when the catalog does not load", async () => {
    vi.mocked(manageCatalog.load).mockRejectedValueOnce(new Error("down"));
    render(<Harness />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry catalog" }));
    expect(await screen.findByRole("option", { name: "City" })).toBeInTheDocument();
  });
});
