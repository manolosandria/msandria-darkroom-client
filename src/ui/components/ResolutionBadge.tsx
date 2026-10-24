import "./resolutionBadge.css";
export function resolutionUses(width: number, height: number) {
  const long = Math.max(width, height),
    short = Math.min(width, height);
  return [
    { icon: "▦", name: "Thumbnail", ok: short >= 180 && long >= 320 },
    { icon: "▯", name: "Mobile · 720p", ok: short >= 720 && long >= 1280 },
    { icon: "▰", name: "HD · 1080p", ok: short >= 1080 && long >= 1920 },
    { icon: "▣", name: "4K · 2160p", ok: short >= 2160 && long >= 3840 },
  ];
}
export function ResolutionBadge({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <span
      className="resolution-badge"
      title="Reference pixel sizes at 1× density; framing, compression and screen density also affect sharpness."
    >
      <strong>
        {Math.round(width)} × {Math.round(height)} px
      </strong>
      {resolutionUses(width, height).map((use) => (
        <span
          key={use.name}
          data-ready={use.ok}
          title={`${use.name}: ${use.ok ? "enough pixels at reference size" : "below reference size"}`}
        >
          {use.name} {use.ok ? "✓" : "—"}
        </span>
      ))}
      <small>Reference sizes · 1× pixels</small>
    </span>
  );
}
