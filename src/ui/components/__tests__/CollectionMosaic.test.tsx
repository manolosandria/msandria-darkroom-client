import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CollectionMosaic } from "../CollectionMosaic";
import { Photo } from "@/src/domain/entities/Photo";

const photo = (id: string) =>
  new Photo({
    id,
    title: id,
    width: 600,
    height: 400,
    renditions: [{ width: 600, url: `https://cdn/${id}.jpg` }],
  });

it("places each piece in its cell, a later page starting at its own first row", () => {
  render(
    <CollectionMosaic
      mosaic
      tiles={[
        {
          key: "a",
          photo: photo("a"),
          variants: [],
          entry: { photoId: "a", columns: 2, rows: 2, column: 3, row: 41 },
        },
        {
          key: "b",
          photo: photo("b"),
          variants: [],
          entry: { photoId: "b", columns: 2, rows: 2, column: 7, row: 44 },
        },
      ]}
      texts={[
        {
          position: 9,
          text: "Night",
          columns: 4,
          rows: 1,
          column: 1,
          row: 47,
        },
      ]}
    />,
  );
  const [first, second, text] = screen.getAllByRole("listitem");
  expect(first).toHaveStyle({ "--start-row": "1", "--start-column": "3" });
  // The gap between the two photos stays.
  expect(second).toHaveStyle({ "--start-row": "4", "--start-column": "7" });
  expect(text).toHaveTextContent("Night");
  expect(text).toHaveStyle({ "--start-row": "7", "--start-column": "1" });
  // The photograph keeps its own proportion inside the piece.
  expect(first.querySelector(".mosaic-photo")).toHaveStyle({
    "--photo-ratio": "1.5",
  });
});
