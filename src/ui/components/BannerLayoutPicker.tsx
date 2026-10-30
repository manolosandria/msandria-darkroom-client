"use client";
import {
  defaultWelcomePanel,
  welcomePositions,
  WelcomePanel,
  WelcomePosition,
} from "@/src/domain/entities/HomeBanner";

const layouts = [
  { id: "text-left", label: "Welcome left" },
  { id: "text-right", label: "Welcome right" },
  { id: "text-top", label: "Welcome above" },
  { id: "text-bottom", label: "Welcome below" },
  { id: "text-overlay", label: "Welcome over photo" },
] as const;

// A small drawing of the banner for each layout: the photograph as a dark block and
// Welcome as a few lines of text, placed as the layout places them.
function LayoutSketch({ layout }: { layout: string }) {
  const photo = (
    {
      "text-left": [26, 4, 34, 32],
      "text-right": [4, 4, 34, 32],
      "text-top": [4, 16, 56, 20],
      "text-bottom": [4, 4, 56, 20],
      "text-overlay": [4, 4, 56, 32],
    } as Record<string, number[]>
  )[layout];
  const text = (
    {
      "text-left": [6, 12],
      "text-right": [42, 12],
      "text-top": [6, 6],
      "text-bottom": [6, 27],
      "text-overlay": [9, 22],
    } as Record<string, number[]>
  )[layout];
  const overlay = layout === "text-overlay";
  const wide = layout === "text-top" || layout === "text-bottom";
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true" className="layout-sketch">
      <rect
        x={photo[0]}
        y={photo[1]}
        width={photo[2]}
        height={photo[3]}
        rx="2"
        className="layout-sketch__photo"
      />
      <path
        d={`M${photo[0] + photo[2] * 0.55} ${photo[1] + photo[3] * 0.75} l${photo[2] * 0.15} ${-photo[3] * 0.3} l${photo[2] * 0.15} ${photo[3] * 0.3} z`}
        className="layout-sketch__peak"
      />
      {overlay && (
        <rect x="7" y="19" width="26" height="14" rx="2" className="layout-sketch__panel" />
      )}
      <rect
        x={text[0]}
        y={text[1]}
        width={wide ? 22 : 14}
        height="3"
        rx="1.5"
        className="layout-sketch__title"
      />
      <rect
        x={text[0]}
        y={text[1] + 5}
        width={wide ? 30 : 16}
        height="3"
        rx="1.5"
        className="layout-sketch__accent"
      />
      {!wide && (
        <rect
          x={text[0]}
          y={text[1] + 10}
          width="9"
          height="2"
          rx="1"
          className="layout-sketch__link"
        />
      )}
    </svg>
  );
}

/** Where Welcome sits relative to the photographs, chosen from drawings of each. */
export function BannerLayoutPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (layout: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="layout-picker" role="radiogroup" aria-label="Welcome placement">
      {layouts.map((layout) => (
        <button
          key={layout.id}
          type="button"
          role="radio"
          aria-checked={value === layout.id}
          disabled={disabled}
          className="layout-picker__option"
          onClick={() => onChange(layout.id)}
        >
          <LayoutSketch layout={layout.id} />
          <span>{layout.label}</span>
        </button>
      ))}
    </div>
  );
}

const panelStyles = [
  { id: "solid", label: "Solid" },
  { id: "glass", label: "Frosted glass" },
  { id: "gradient", label: "Soft fade" },
  { id: "none", label: "Text only" },
] as const;
const positionLabel = (position: WelcomePosition) =>
  position === "center"
    ? "Center"
    : position[0].toUpperCase() + position.slice(1).replace("-", " ");

/** The Welcome panel over the photograph: anchor, width, panel style and colors. */
export function WelcomePanelControls({
  welcome = defaultWelcomePanel,
  opacity,
  onChange,
  onOpacityChange,
  disabled,
}: {
  welcome?: WelcomePanel;
  opacity: number;
  onChange: (welcome: WelcomePanel) => void;
  onOpacityChange: (opacity: number) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<WelcomePanel>) => onChange({ ...welcome, ...patch });
  return (
    <fieldset className="welcome-panel-controls" disabled={disabled}>
      <legend>Welcome over the photograph</legend>
      <div className="welcome-panel-controls__grid">
        <div>
          <p className="welcome-panel-controls__label">Position</p>
          <div
            className="welcome-anchor"
            role="radiogroup"
            aria-label="Welcome position"
          >
            {welcomePositions.map((position) => (
              <button
                key={position}
                type="button"
                role="radio"
                aria-checked={welcome.position === position}
                aria-label={positionLabel(position)}
                title={positionLabel(position)}
                onClick={() => set({ position })}
              >
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <div className="welcome-panel-controls__sliders">
          <label>
            Width · {welcome.width}%
            <input
              type="range"
              min={25}
              max={90}
              step={5}
              value={welcome.width}
              onChange={(e) => set({ width: Number(e.target.value) })}
            />
          </label>
          <label>
            Panel opacity · {opacity}%
            <input
              type="range"
              min={0}
              max={85}
              value={opacity}
              disabled={welcome.panel === "none"}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
            />
          </label>
          <label>
            Corner radius · {welcome.radius}px
            <input
              type="range"
              min={0}
              max={32}
              value={welcome.radius}
              disabled={welcome.panel === "none"}
              onChange={(e) => set({ radius: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
      <p className="welcome-panel-controls__label">Panel</p>
      <div className="welcome-panel-styles" role="radiogroup" aria-label="Panel style">
        {panelStyles.map((style) => (
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={welcome.panel === style.id}
            onClick={() => set({ panel: style.id })}
          >
            <span
              className={`welcome-panel-styles__swatch welcome-panel-styles__swatch--${style.id}`}
              style={{ "--swatch": welcome.panelColor } as React.CSSProperties}
              aria-hidden="true"
            >
              Aa
            </span>
            {style.label}
          </button>
        ))}
      </div>
      <div className="welcome-panel-controls__colors">
        <label>
          Panel color
          <input
            type="color"
            value={welcome.panelColor}
            disabled={welcome.panel === "none"}
            onChange={(e) => set({ panelColor: e.target.value })}
          />
        </label>
        <label>
          Text color
          <input
            type="color"
            value={welcome.textColor}
            onChange={(e) => set({ textColor: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="welcome-panel-controls__swap"
          onClick={() =>
            set({ panelColor: welcome.textColor, textColor: welcome.panelColor })
          }
        >
          Swap colors
        </button>
      </div>
    </fieldset>
  );
}
