import { useRef } from "react";
export function BannerDragHandle({
  block,
  onChange,
}: {
  block: "text" | "photo";
  onChange: (layout: string) => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <button
      type="button"
      draggable={false}
      className="banner-live-handle"
      title={`Drag ${block === "text" ? "Welcome" : "Photographs"} to arrange`}
      aria-label={`Drag ${block === "text" ? "Welcome" : "Photographs"} to arrange`}
      onPointerDown={(event) => {
        event.stopPropagation();
        start.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        const origin = start.current;
        start.current = null;
        if (!origin) return;
        const x = event.clientX - origin.x,
          y = event.clientY - origin.y;
        if (Math.max(Math.abs(x), Math.abs(y)) < 25) return;
        const side =
          Math.abs(x) > Math.abs(y)
            ? x < 0
              ? "left"
              : "right"
            : y < 0
              ? "top"
              : "bottom";
        const inverse: Record<string, string> = {
          left: "right",
          right: "left",
          top: "bottom",
          bottom: "top",
        };
        onChange(`text-${block === "text" ? side : inverse[side]}`);
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      <span aria-hidden="true">⠿</span>
      <small>
        {block === "text" ? "Welcome" : "Photographs"} · drag to arrange
      </small>
    </button>
  );
}
