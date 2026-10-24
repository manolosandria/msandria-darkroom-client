"use client";
import { useRef, useState } from "react";
const zones = [
  { id: "text-top", label: "Above photographs" },
  { id: "text-left", label: "Left of photographs" },
  { id: "text-right", label: "Right of photographs" },
  { id: "text-bottom", label: "Below photographs" },
];
export function BannerComposition({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<"text" | "photo" | null>(null);
  const [moving, setMoving] = useState<"text" | "photo" | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const invert = (zone: string) =>
    ({
      "text-left": "text-right",
      "text-right": "text-left",
      "text-top": "text-bottom",
      "text-bottom": "text-top",
    })[zone]!;
  function hit(x: number, y: number) {
    const nodes =
      board.current?.querySelectorAll<HTMLButtonElement>("[data-zone]");
    return (
      Array.from(nodes ?? []).find((node) => {
        const r = node.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      })?.dataset.zone ?? null
    );
  }
  function place(zone: string, block = moving) {
    if (!disabled) onChange(block === "photo" ? invert(zone) : zone);
    setMoving(null);
    setOver(null);
  }
  return (
    <section className="banner-composition" aria-label="Arrange banner blocks">
      <h2>Arrange your blocks</h2>
      <p>
        Drag Welcome or Photographs onto an edge. Or select a block, then choose
        its destination. Arrow keys move the selected block; Escape cancels.
      </p>
      <div className="banner-composition__blocks">
        {(["text", "photo"] as const).map((block) => (
          <button
            key={block}
            type="button"
            disabled={disabled}
            aria-pressed={moving === block}
            className="banner-composition__handle"
            onClick={() => setMoving(block)}
            onKeyDown={(event) => {
              const target = (
                {
                  ArrowUp: "text-top",
                  ArrowDown: "text-bottom",
                  ArrowLeft: "text-left",
                  ArrowRight: "text-right",
                } as Record<string, string>
              )[event.key];
              if (target) {
                event.preventDefault();
                place(target, block);
              }
              if (event.key === "Escape") {
                setMoving(null);
                setOver(null);
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              drag.current = block;
              setMoving(block);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (drag.current) setOver(hit(event.clientX, event.clientY));
            }}
            onPointerUp={(event) => {
              const block = drag.current;
              drag.current = null;
              const target = hit(event.clientX, event.clientY);
              if (block && target) place(target, block);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setMoving(null);
              setOver(null);
            }}
          >
            ⠿ {block === "text" ? "Welcome" : "Photographs"}
          </button>
        ))}
      </div>
      <div className="banner-composition__board" ref={board}>
        <div className="banner-composition__photo">Photographs</div>
        {zones.map((zone) => (
          <button
            key={zone.id}
            type="button"
            data-zone={zone.id}
            disabled={disabled}
            aria-label={`Place ${moving === "photo" ? "photographs" : "welcome"} ${zone.label.toLowerCase()}`}
            aria-pressed={value === zone.id}
            className={`banner-composition__zone banner-composition__zone--${zone.id} ${over === zone.id ? "is-over" : ""}`}
            onClick={() => place(zone.id)}
          >
            {value === zone.id ? "Welcome · " : ""}
            {zone.label}
          </button>
        ))}
      </div>
      <p aria-live="polite">
        Welcome: {zones.find((zone) => zone.id === value)?.label.toLowerCase()}.
      </p>
    </section>
  );
}
