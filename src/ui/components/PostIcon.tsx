type IconName =
  | "plus"
  | "text"
  | "photo"
  | "upload"
  | "save"
  | "undo"
  | "eye"
  | "edit"
  | "trash"
  | "up"
  | "down"
  | "grip"
  | "search"
  | "calendar"
  | "check"
  | "desktop"
  | "phone";

const paths: Record<IconName, string> = {
  plus: "M12 5v14M5 12h14",
  text: "M5 6h14M12 6v13M8 19h8",
  photo: "M4 3h16v18H4ZM4 16l5-5 4 4 3-3 4 4M15 7h.01",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
  save: "M4 3h13l3 3v15H4ZM8 3v6h8V3M8 21v-8h8v8",
  undo: "m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  edit: "m15 3 6 6-12 12H3v-6L15 3Zm-3 3 6 6",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  up: "M12 20V4m-6 6 6-6 6 6",
  down: "M12 4v16m-6-6 6 6 6-6",
  grip: "M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01",
  search: "M21 21l-6-6m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  calendar: "M4 5h16v16H4ZM4 10h16M8 3v4M16 3v4M8 14h3M8 17h7",
  check: "m5 12 4 4L19 6",
  desktop: "M3 4h18v13H3ZM12 17v4M7 21h10",
  phone: "M7 2h10v20H7ZM11 18h2",
};

export function PostIcon({ name }: { name: IconName }) {
  return (
    <svg
      className="post-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "grip" ? 3 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
