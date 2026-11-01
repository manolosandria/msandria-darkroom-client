// Line drawings for the choices editors offer as icons (`SegmentedChoice`,
// `ChoiceMenu`): 20 × 20, stroked in the current color.
const draw = (...paths: string[]) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths.map((d) => (
      <path key={d} d={d} />
    ))}
  </svg>
);

export const choiceIcons = {
  alignLeft: draw("M3 5h14", "M3 9h9", "M3 13h14", "M3 17h9"),
  alignCenter: draw("M3 5h14", "M5.5 9h9", "M3 13h14", "M5.5 17h9"),
  alignRight: draw("M3 5h14", "M8 9h9", "M3 13h14", "M8 17h9"),
  shapeRectangle: draw("M3 5h14v10H3z"),
  shapeRounded: draw(
    "M6 5h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z",
  ),
  shapeArch: draw("M3 16V10a7 7 0 0 1 14 0v6z"),
  navigationDots: draw(
    "M5 10h.01",
    "M10 10h.01",
    "M15 10h.01",
    "M3 5h14v10H3z",
  ),
  navigationThumbnails: draw(
    "M2 6h5v4H2z",
    "M7.5 6h5v4h-5z",
    "M13 6h5v4h-5z",
    "M2 13h16",
  ),
  navigationProgress: draw("M3 10h14", "M3 10h7", "M10 8v4"),
  placeBelow: draw("M3 3h14v9H3z", "M7 16h.01", "M10 16h.01", "M13 16h.01"),
  placeOver: draw("M3 3h14v14H3z", "M7 13h.01", "M10 13h.01", "M13 13h.01"),
  blockEyebrow: draw("M3 8h6", "M3 12h14", "M3 15.5h10"),
  blockTitle: draw("M4 5h12", "M10 5v11"),
  blockBody: draw("M3 5h14", "M3 9h14", "M3 13h14", "M3 17h8"),
  general: draw(
    "M3 3h6v6H3z",
    "M11 3h6v6h-6z",
    "M3 11h6v6H3z",
    "M11 11h6v6h-6z",
  ),
  crossStart: draw("M4 3v14", "M7 6h9", "M7 10h5", "M7 14h7"),
  crossCenter: draw("M10 3v14", "M5.5 6h9", "M7.5 10h5", "M6.5 14h7"),
  crossEnd: draw("M16 3v14", "M4 6h9", "M8 10h5", "M6 14h7"),
  crossStretch: draw("M4 3v14", "M16 3v14", "M7 7h6", "M7 13h6"),
  mainStart: draw("M3 4v12", "M5 7h3v6H5z", "M9 7h3v6H9z"),
  mainCenter: draw("M5 7h3v6H5z", "M12 7h3v6h-3z", "M10 4v12"),
  mainEnd: draw("M17 4v12", "M8 7h3v6H8z", "M12 7h3v6h-3z"),
  mainBetween: draw("M3 4v12", "M17 4v12", "M5 7h3v6H5z", "M12 7h3v6h-3z"),
};
