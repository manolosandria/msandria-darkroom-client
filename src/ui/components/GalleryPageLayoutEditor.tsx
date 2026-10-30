"use client";
import { ReactNode } from "react";
import {
  defaultGalleryPageLayout,
  GalleryPageBlock,
  galleryPageBlockLabels,
  GalleryPageLayout,
} from "@/src/domain/entities/GallerySettings";

/** The blocks in reading order, and whether each one shares a card with the next. */
export function flattenGroups(groups: GalleryPageBlock[][]) {
  const order = groups.flat();
  const joined = order.slice(0, -1).map((block, index) =>
    groups.some(
      (group) => group.includes(block) && group.includes(order[index + 1]),
    ),
  );
  return { order, joined };
}
export function buildGroups(order: GalleryPageBlock[], joined: boolean[]) {
  const groups: GalleryPageBlock[][] = [];
  order.forEach((block, index) => {
    if (index > 0 && joined[index - 1]) groups[groups.length - 1].push(block);
    else groups.push([block]);
  });
  return groups;
}

const presets: { label: string; groups: GalleryPageBlock[][] }[] = [
  { label: "Title and filters together", groups: [["heading", "filters"], ["photos"]] },
  { label: "All in one card", groups: [["heading", "filters", "photos"]] },
  { label: "Each in its own card", groups: [["heading"], ["filters"], ["photos"]] },
  { label: "Filters with the photographs", groups: [["heading"], ["filters", "photos"]] },
];

// A small drawing of the page: one rounded card per group, its blocks inside.
function LayoutDrawing({
  groups,
  side,
}: {
  groups: GalleryPageBlock[][];
  side: boolean;
}) {
  const heights: Record<GalleryPageBlock, number> = {
    heading: 8,
    filters: 4,
    photos: 14,
  };
  let y = 2;
  const shapes: ReactNode[] = [];
  groups.forEach((group, index) => {
    const top = y;
    let inner = top + 2;
    const pairInside =
      side && group.includes("heading") && group.includes("filters");
    group.forEach((block) => {
      if (pairInside && block === "filters") return;
      const height =
        pairInside && block === "heading" ? heights.heading : heights[block];
      if (pairInside && block === "heading") {
        shapes.push(
          <rect key={`${index}h`} x={5} y={inner} width={16} height={height} className="layout-drawing__heading" />,
          <rect key={`${index}f`} x={23} y={inner + height - 4} width={20} height={4} className="layout-drawing__filters" />,
        );
      } else
        shapes.push(
          <rect key={`${index}${block}`} x={5} y={inner} width={38} height={height} className={`layout-drawing__${block}`} />,
        );
      inner += height + 2;
    });
    shapes.unshift(
      <rect key={`card${index}`} x={2} y={top} width={44} height={inner - top} rx={2.5} className="layout-drawing__card" />,
    );
    y = inner + 2;
  });
  return (
    <svg viewBox={`0 0 48 ${y}`} width="48" height={y} aria-hidden="true" className="layout-drawing">
      {shapes}
    </svg>
  );
}

export function GalleryPageLayoutEditor({
  value = defaultGalleryPageLayout,
  disabled,
  onChange,
}: {
  value?: GalleryPageLayout;
  disabled: boolean;
  onChange: (value: GalleryPageLayout) => void;
}) {
  const { order, joined } = flattenGroups(value.groups);
  const set = (patch: Partial<GalleryPageLayout>) =>
    onChange({ ...value, ...patch });
  const move = (index: number, step: number) => {
    const to = index + step;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[index], next[to]] = [next[to], next[index]];
    set({ groups: buildGroups(next, joined) });
  };
  const same = (a: GalleryPageBlock[][], b: GalleryPageBlock[][]) =>
    JSON.stringify(a) === JSON.stringify(b);
  return (
    <fieldset disabled={disabled} className="gallery-page-layout">
      <legend>Page layout</legend>
      <p className="gallery-page-layout__help">
        Put the title, the filters and the photographs in cards: together, apart,
        and in the order you want.
      </p>
      <div className="gallery-page-layout__presets" role="group" aria-label="Layouts">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={same(preset.groups, value.groups)}
            title={preset.label}
            onClick={() => set({ groups: preset.groups })}
          >
            <LayoutDrawing groups={preset.groups} side={value.filtersPlacement === "side"} />
            <small>{preset.label}</small>
          </button>
        ))}
      </div>
      <ol className="gallery-page-layout__sequence" aria-label="Blocks in reading order">
        {order.map((block, index) => (
          <li key={block}>
            {index > 0 && (
              <button
                type="button"
                className="gallery-page-layout__join"
                aria-pressed={joined[index - 1]}
                title={
                  joined[index - 1]
                    ? `${galleryPageBlockLabels[order[index - 1]]} and ${galleryPageBlockLabels[block]} share a card`
                    : `${galleryPageBlockLabels[block]} starts a new card`
                }
                onClick={() => {
                  const next = [...joined];
                  next[index - 1] = !next[index - 1];
                  set({ groups: buildGroups(order, next) });
                }}
              >
                {joined[index - 1] ? "Same card" : "New card"}
              </button>
            )}
            <span className="gallery-page-layout__block" data-block={block}>
              <span>{galleryPageBlockLabels[block]}</span>
              <button
                type="button"
                aria-label={`Move ${galleryPageBlockLabels[block]} earlier`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${galleryPageBlockLabels[block]} later`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="gallery-page-layout__choice" role="radiogroup" aria-label="Filters">
        <span>Filters</span>
        {(["below", "side"] as const).map((placement) => (
          <button
            key={placement}
            type="button"
            role="radio"
            aria-checked={value.filtersPlacement === placement}
            onClick={() => set({ filtersPlacement: placement })}
          >
            {placement === "below" ? "Below the title" : "Beside the title"}
          </button>
        ))}
      </div>
      <div className="gallery-page-layout__choice" role="radiogroup" aria-label="Title alignment">
        <span>Title</span>
        {(["start", "center", "end"] as const).map((align) => (
          <button
            key={align}
            type="button"
            role="radio"
            aria-checked={value.headingAlign === align}
            onClick={() => set({ headingAlign: align })}
          >
            {align === "start" ? "Left" : align === "center" ? "Centered" : "Right"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
