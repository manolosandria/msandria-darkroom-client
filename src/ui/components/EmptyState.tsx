import { ReactNode } from "react";
import "./emptyState.css";

const pictures = {
  inbox: "M3 11l2.5-6h9L17 11v5H3zM3 11h4l1 2h4l1-2h4",
  comments: "M4 4h12v8H9l-4 3v-3H4zM7 7.5h6M7 9.5h4",
  photos: "M3 5h14v10H3zM3 13l4-4 3 3 2-2 5 5M13 8h.01",
  search: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM13.5 13.5 17 17",
  collections: "M5 6h10v11H5zM7 3h6M6 4.5h8",
  done: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM7 10l2 2 4-4",
};

/**
 * What a list says when it has nothing to show: a drawing in a soft circle, a short
 * title and, if useful, a line or an action under it, centered in the space the list
 * would take. `quiet` drops the card for places that already sit in one.
 */
export function EmptyState({
  picture,
  title,
  children,
  quiet = false,
}: {
  picture: keyof typeof pictures;
  title: string;
  children?: ReactNode;
  quiet?: boolean;
}) {
  return (
    <div className={`empty-state${quiet ? " empty-state--quiet" : ""}`}>
      <span className="empty-state__picture" aria-hidden="true">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={pictures[picture]} />
        </svg>
      </span>
      <p className="empty-state__title">{title}</p>
      {children && <div className="empty-state__note">{children}</div>}
    </div>
  );
}
