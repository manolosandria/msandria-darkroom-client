import { PhotoView } from "@/src/domain/photoPresentation";
export type PackedTile = {
  x: number;
  y: number;
  width: number;
  height: number;
  view: PhotoView;
  large: boolean;
};
export type GalleryPacking = { rows: number; tiles: PackedTile[] };
export function galleryPriorities(keys: string[]) {
  const seed = keys.join("|");
  return new Set(
    keys
      .map((key, index) => {
        let hash = 2166136261;
        for (const char of seed + key)
          hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
        return { index, score: hash >>> 0 };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.min(2, Math.floor(keys.length / 3)))
      .map((item) => item.index),
  );
}
// Exact rectangle packing. Try compatible crops, tall portraits and at most two
// emphasis tiles, rather than letting CSS leave an unfinished final row.
export function packGallery(
  keys: string[],
  views: PhotoView[][],
  columns: number,
): GalleryPacking {
  if (!keys.length) return { rows: 0, tiles: [] };
  const priorities = galleryPriorities(keys);
  const choices = views.map((options, index) =>
    options.flatMap((view) => {
      const sizes =
        view.ratio < 0.85
          ? [[1, 2]]
          : [
              ...(priorities.has(index) ? [[2, 2]] : []),
              [1, 1],
              [2, 1],
              ...(view.ratio > 1.1 ? [[3, 1]] : []),
            ];
      return sizes
        .filter(([w]) => w <= columns && (keys.length === 1 || w < columns))
        .map(([width, height]) => ({
          width,
          height,
          view,
          large: width * height >= 4,
        }));
    }),
  );
  const minArea = choices.reduce(
    (sum, options) =>
      sum + Math.min(...options.map((item) => item.width * item.height)),
    0,
  );
  const maxArea = choices.reduce(
    (sum, options) =>
      sum + Math.max(...options.map((item) => item.width * item.height)),
    0,
  );
  const preferred = Math.round(
    choices.reduce(
      (sum, options) => sum + options[0].width * options[0].height,
      0,
    ) / columns,
  );
  const rowCounts = Array.from(
    {
      length: Math.max(
        0,
        Math.floor(maxArea / columns) - Math.ceil(minArea / columns) + 1,
      ),
    },
    (_, i) => i + Math.ceil(minArea / columns),
  ).sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
  let budget = 18000;
  for (const rows of rowCounts) {
    const cells = Array<boolean>(rows * columns).fill(false);
    const placed: PackedTile[] = [];
    const failed = new Set<string>();
    function search(used: number, large: number): boolean {
      if (--budget < 0) return false;
      const start = cells.indexOf(false);
      if (start < 0) return used === (1 << keys.length) - 1;
      const free = cells.filter((cell) => !cell).length;
      let least = 0,
        most = 0;
      for (let i = 0; i < keys.length; i++)
        if (!(used & (1 << i))) {
          least += Math.min(
            ...choices[i].map((item) => item.width * item.height),
          );
          most += Math.max(
            ...choices[i].map((item) => item.width * item.height),
          );
        }
      if (free < least || free > most) return false;
      const state = `${used}:${large}:${cells.map((cell) => (cell ? 1 : 0)).join("")}`;
      if (failed.has(state)) return false;
      const x = start % columns,
        y = Math.floor(start / columns);
      for (let index = 0; index < keys.length; index++) {
        if (used & (1 << index)) continue;
        for (const choice of choices[index]) {
          if (
            x + choice.width > columns ||
            y + choice.height > rows ||
            large + Number(choice.large) > 2
          )
            continue;
          const footprint: number[] = [];
          for (let dy = 0; dy < choice.height; dy++)
            for (let dx = 0; dx < choice.width; dx++)
              footprint.push((y + dy) * columns + x + dx);
          if (footprint.some((cell) => cells[cell])) continue;
          for (const cell of footprint) cells[cell] = true;
          placed[index] = {
            ...choice,
            x: x / columns,
            y,
            width: choice.width / columns,
          };
          if (search(used | (1 << index), large + Number(choice.large)))
            return true;
          for (const cell of footprint) cells[cell] = false;
        }
      }
      failed.add(state);
      return false;
    }
    if (search(0, 0)) return { rows, tiles: placed };
    if (budget < 0) break;
  }
  // Unusual all-portrait sets still fill the width. Balanced bands avoid a lone
  // tile on the last row, without inventing or repeating photographs.
  const bands = Math.ceil(keys.length / columns);
  const tiles: PackedTile[] = [];
  let index = 0,
    y = 0;
  for (let band = 0; band < bands; band++) {
    const count = Math.ceil((keys.length - index) / (bands - band));
    const row = views.slice(index, index + count).map((options) => options[0]);
    const height = row.some((view) => view.ratio < 0.85) ? 2 : 1;
    const total = row.reduce((sum, view) => sum + view.ratio, 0);
    let x = 0;
    for (const view of row) {
      const width = view.ratio / total;
      tiles.push({ x, y, width, height, view, large: false });
      x += width;
    }
    index += count;
    y += height;
  }
  return { rows: y, tiles };
}
