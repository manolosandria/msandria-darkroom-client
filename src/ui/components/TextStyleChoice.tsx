"use client";
import "./catalogStudio.css";

export type TextStyle = "HEADING" | "BODY" | "QUOTE";
export const TEXT_STYLES: TextStyle[] = ["HEADING", "BODY", "QUOTE"];
export const TEXT_STYLE_LABELS: Record<TextStyle, string> = {
  HEADING: "Heading",
  BODY: "Paragraph",
  QUOTE: "Quote",
};

/**
 * The style of a block of words, shared by collections and posts: three cards, each
 * drawn in its own type (a serif "Aa", a plain "Aa", quotation marks), the chosen one
 * lit.
 */
export function TextStyleChoice({
  value,
  onChange,
  label = "Text style",
}: {
  value: TextStyle;
  onChange: (style: TextStyle) => void;
  label?: string;
}) {
  return (
    <div className="text-style-choice" role="group" aria-label={label}>
      {TEXT_STYLES.map((style) => (
        <button
          key={style}
          type="button"
          aria-pressed={value === style}
          data-style={style}
          onClick={() => onChange(style)}
        >
          <span aria-hidden="true">{style === "QUOTE" ? "“”" : "Aa"}</span>
          {TEXT_STYLE_LABELS[style]}
        </button>
      ))}
    </div>
  );
}
