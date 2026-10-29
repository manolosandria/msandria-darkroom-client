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
    await screen.findAllByRole("button", { name: "Add to collection City" });
    expect(manageCatalog.load).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event("curator:catalog-changed"));
    await waitFor(() => expect(manageCatalog.load).toHaveBeenCalledTimes(2));
  });
  it("starts public", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: /Public/ })).toBeChecked();
  });

  it("closes a category with a comma and reuses the existing spelling", async () => {
    render(<Harness />);
    await screen.findByRole("button", { name: "Add category Street" });
    await userEvent.type(screen.getByLabelText("Categories"), "street,Night,");

    expect(latest()?.categoryNames).toEqual(["Street", "Night"]);
    expect(screen.getByLabelText("Categories")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Remove category Night" }));
    expect(latest()?.categoryNames).toEqual(["Street"]);
  });

  it("adds a collection at its end and lets the order change", async () => {
    render(<Harness />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Add to collection City" }),
    );

    expect(latest()?.collections).toEqual([{ id: "col", position: 2 }]);
    expect(screen.getByText("In 1 of 1")).toBeInTheDocument();
    const order = screen.getByLabelText("Order in City");
    await userEvent.clear(order);
    await userEvent.type(order, "1");
    expect(latest()?.collections).toEqual([{ id: "col", position: 1 }]);
    await userEvent.click(screen.getByRole("button", { name: "Remove from collection City" }));
    expect(latest()?.collections).toEqual([]);
  });

  it("filters existing categories as it is typed and creates a new one", async () => {
    vi.mocked(manageCatalog.load).mockResolvedValue({
      ...catalog,
      categories: [
        { id: "cat", name: "Street" },
        { id: "sea", name: "Seascape" },
      ],
    });
    render(<Harness />);
    await screen.findByRole("button", { name: "Add category Seascape" });
    await userEvent.type(screen.getByLabelText("Categories"), "sea");
    expect(
      screen.queryByRole("button", { name: "Add category Street" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add category Seascape" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create/ })).toHaveTextContent(
      "sea",
    );
    await userEvent.clear(screen.getByLabelText("Categories"));
    await userEvent.type(screen.getByLabelText("Categories"), "Harbour");
    await userEvent.click(screen.getByRole("button", { name: /Create/ }));
    expect(latest()?.categoryNames).toEqual(["Harbour"]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("explains a collections-only photo", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("radio", { name: /Collections only/ }));
    expect(screen.getByText(/hidden from the general gallery/)).toBeInTheDocument();
  });

  it("offers a retry when the catalog does not load", async () => {
    vi.mocked(manageCatalog.load).mockRejectedValueOnce(new Error("down"));
    render(<Harness />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry catalog" }));
    expect(await screen.findByRole("button", { name: "Add to collection City" })).toBeInTheDocument();
  });
});
