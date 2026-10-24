import { DisplayIcon } from "./DisplayIcon";
export function VisualChoice({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="visual-choice"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <DisplayIcon
        kind={
          label.toLowerCase().includes("desktop") && !/Landscape|Portrait|Square|Full/.test(label)
            ? "desktop"
            : label.toLowerCase().includes("mobile") && !/Landscape|Portrait|Square|Full/.test(label)
              ? "mobile"
              : label.includes("Landscape")
                ? "landscape"
                : label.includes("Portrait")
                  ? "portrait"
                  : label.includes("Square")
                    ? "square"
                    : icon === "▦"
                      ? "all"
                      : "screen"
        }
      />
      <small>{label}</small>
    </button>
  );
}
