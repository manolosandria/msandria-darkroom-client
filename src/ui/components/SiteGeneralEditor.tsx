"use client";
import "./paletteStudio.css";
import "./siteGeneral.css";
import { useEffect, useRef, useState } from "react";
import {
  contrastRatio,
  defaultSiteSettings,
  headerMinimumContrast,
  headerThemeProperties,
  headerThemes,
  HeaderTheme,
  SiteFont,
  SiteHeaderColors,
  SiteHeaderMaterial,
  SiteHeaderTone,
  SiteNavAlign,
  SiteSettings,
  siteFonts,
  withSiteDefaults,
} from "@/src/domain/entities/SiteSettings";
import { defaultGalleryPalettes } from "@/src/domain/entities/GallerySettings";
import { manageSiteSettings } from "@/src/infrastructure/siteSettingsServices";
import type { ManageSiteSettings } from "@/src/application/use-cases/ManageSiteSettings";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { EditorActions } from "./EditorActions";
import { Segment, SegmentedChoice } from "./SegmentedChoice";
import { useSiteSettings } from "./SiteSettingsProvider";

const icon = (...shapes: React.ReactNode[]) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {shapes}
  </svg>
);
const headerTones: Segment<SiteHeaderTone>[] = [
  {
    value: "light",
    label: "Light",
    icon: icon(
      <circle key="sun" cx="10" cy="10" r="3.2" />,
      <path
        key="rays"
        d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3"
      />,
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: icon(
      <path
        key="moon"
        d="M15.5 12.6A6.2 6.2 0 0 1 7.4 4.5a6.2 6.2 0 1 0 8.1 8.1Z"
      />,
    ),
  },
  {
    value: "auto",
    label: "Automatic, as the visitor's system",
    icon: icon(
      <circle key="ring" cx="10" cy="10" r="6.5" />,
      <path key="half" d="M10 3.5a6.5 6.5 0 0 1 0 13Z" fill="currentColor" />,
    ),
  },
];
const headerMaterials: Segment<SiteHeaderMaterial>[] = [
  {
    value: "solid",
    label: "Solid",
    icon: icon(
      <rect
        key="bar"
        x="2.5"
        y="6"
        width="15"
        height="8"
        rx="2"
        fill="currentColor"
      />,
    ),
  },
  {
    value: "glass",
    label: "Frosted glass",
    icon: icon(
      <rect key="bar" x="2.5" y="6" width="15" height="8" rx="2" />,
      <path key="sheen" d="M6 12.5 9 7.5M9.5 12.5l3-5" strokeWidth="1.1" />,
    ),
  },
];
// A small header in each drawing: the logo on the left, the account on the right and
// the three links where the choice puts them.
const headerDrawing = (linksFrom: number) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <rect x="1" y="5.5" width="18" height="9" rx="2" strokeWidth="1.2" />
    <path d="M3.5 10h2.5" strokeWidth="2.2" />
    <circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <path
      d={[0, 1.6, 3.2]
        .map((step) => `M${linksFrom + step} 10h.6`)
        .join("")}
      strokeWidth="1.5"
    />
  </svg>
);
const navAligns: Segment<SiteNavAlign>[] = [
  { value: "start", label: "Beside the logo", icon: headerDrawing(7.5) },
  { value: "center", label: "Centered", icon: headerDrawing(9.2) },
  { value: "end", label: "Towards the account", icon: headerDrawing(11.6) },
];
const fonts: [SiteFont, string][] = [
  ["serif", "Serif"],
  ["sans", "Sans"],
  ["mono", "Mono"],
];
const paletteKeys = ["background", "text", "accent", "surface"] as const;

/**
 * Curator → Sections → General: the look every page shares. The header's tone,
 * material and colors, whether it leaves on scroll and where its links sit, the
 * fonts and the main palette. Nothing changes on the site until it is saved.
 */
export default function SiteGeneralEditor({
  service = manageSiteSettings,
}: {
  service?: ManageSiteSettings;
}) {
  const { confirm } = useEditingWorkspace();
  const site = useSiteSettings();
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<SiteSettings>(defaultSiteSettings);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const dirty = !!saved && JSON.stringify(saved) !== JSON.stringify(draft);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const loaded = withSiteDefaults(await service.get());
      setSaved(loaded);
      setDraft(loaded);
      setNotice("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    // Only once: afterwards the draft is the curator's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (lock.current || !saved) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await service.save(draft);
      setSaved(result);
      setDraft(result);
      site.adopt(result);
      setNotice("General settings saved.");
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const { review } = useUnsavedEditor(dirty, {
    label: "General",
    save,
    discard: () => saved && setDraft(saved),
    document: saved
      ? {
          original: saved,
          draft,
          restore: (value) => setDraft(value as SiteSettings),
        }
      : undefined,
  });

  const themes = headerThemes(draft);
  const change = (next: Partial<SiteSettings>) => {
    setDraft((previous) => ({ ...previous, ...next }));
    setNotice("");
  };
  const changeHeader = (next: Partial<SiteSettings["header"]>) => {
    setDraft((previous) => ({
      ...previous,
      header: withoutEmpty({ ...previous.header, ...next }),
    }));
    setNotice("");
  };

  return (
    <div className="palette-manager site-general">
      <header>
        <h1>The whole site.</h1>
        <p>
          The header every page shares, the fonts and the main palette. Home,
          Gallery and collections with a look of their own keep it.
        </p>
        {saved && (
          <EditorActions
            form="site-general-form"
            busy={busy}
            dirty={dirty}
            saveLabel="Save general settings"
            onCancel={async () => {
              if (
                await confirm(
                  "Cancel changes?",
                  "Return to the saved settings?",
                )
              )
                setDraft(saved);
            }}
            onRestore={() => change({ ...defaultSiteSettings, version: draft.version })}
          />
        )}
      </header>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" disabled={busy} onClick={() => void load()}>
            Reload state
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!saved ? (
        <p>{busy ? "Loading settings…" : "Settings are unavailable."}</p>
      ) : (
        <div className="site-general__layout">
          <form
            id="site-general-form"
            className="site-general__form"
            onSubmit={async (event) => {
              event.preventDefault();
              await review();
            }}
          >
            <fieldset disabled={busy}>
              <legend>Header</legend>
              <SegmentedChoice
                label="Tone"
                options={headerTones}
                value={draft.header.tone}
                disabled={busy}
                onChange={(tone) => changeHeader({ tone })}
              />
              <SegmentedChoice
                label="Material"
                options={headerMaterials}
                value={draft.header.material}
                disabled={busy}
                onChange={(material) => changeHeader({ material })}
              />
              <SegmentedChoice
                label="Links"
                options={navAligns}
                value={draft.header.navAlign}
                disabled={busy}
                onChange={(navAlign) => changeHeader({ navAlign })}
              />
              <label className="site-general__switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={draft.header.hideOnScroll}
                  onChange={(event) =>
                    changeHeader({ hideOnScroll: event.target.checked })
                  }
                />
                <span className="site-general__track" aria-hidden="true" />
                <span>
                  Hide it on scroll and keep the floating logo with the menu
                </span>
              </label>
              <p className="site-general__hint">
                Off, the header stays fixed at the top while the page scrolls.
              </p>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Header colors</legend>
              <p className="site-general__hint">
                Each tone comes from the main palette unless you pick it by hand.
                {draft.header.tone === "auto" &&
                  " Automatic shows each visitor the tone of their system, so both count."}
              </p>
              {(["light", "dark"] as const).map((tone) => (
                <HeaderToneCard
                  key={tone}
                  tone={tone}
                  theme={themes[tone]}
                  inUse={
                    draft.header.tone === tone || draft.header.tone === "auto"
                  }
                  onChange={(colors) => changeHeader({ [tone]: colors })}
                  onReset={() => changeHeader({ [tone]: undefined })}
                />
              ))}
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Fonts</legend>
              <Choices
                name="heading-font"
                label="Headings"
                options={fonts}
                value={draft.headingFont}
                onChange={(headingFont) => change({ headingFont })}
                font
              />
              <Choices
                name="body-font"
                label="Text"
                options={fonts}
                value={draft.bodyFont}
                onChange={(bodyFont) => change({ bodyFont })}
                font
              />
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Main palette</legend>
              <div className="site-general__presets">
                {defaultGalleryPalettes.map((palette) => (
                  <button
                    key={palette.id}
                    type="button"
                    title={`Use ${palette.name}`}
                    aria-label={`Use the ${palette.name} palette`}
                    onClick={() =>
                      change({
                        // Colors picked by hand belonged to the previous palette.
                        header: withoutEmpty({
                          ...draft.header,
                          light: undefined,
                          dark: undefined,
                        }),
                        palette: {
                          background: palette.background,
                          text: palette.text,
                          accent: palette.accent,
                          surface: palette.surface,
                        },
                      })
                    }
                  >
                    {paletteKeys.map((key) => (
                      <span key={key} style={{ background: palette[key] }} />
                    ))}
                    <small>{palette.name}</small>
                  </button>
                ))}
              </div>
              <div className="site-general__colors">
                {paletteKeys.map((key) => (
                  <label key={key}>
                    <input
                      type="color"
                      aria-label={`Site ${key}`}
                      value={draft.palette[key]}
                      onChange={(event) =>
                        change({
                          palette: { ...draft.palette, [key]: event.target.value },
                        })
                      }
                    />
                    <span>
                      {key[0].toUpperCase() + key.slice(1)}
                      <code>{draft.palette[key]}</code>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
          <SitePreview settings={draft} />
        </div>
      )}
    </div>
  );
}

function Choices<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
  font,
}: {
  name: string;
  label: string;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
  font?: boolean;
}) {
  return (
    <div className="site-general__choices" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div>
        {options.map(([option, text]) => (
          <label key={option} className={value === option ? "is-on" : ""}>
            <input
              type="radio"
              name={name}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span
              style={
                font ? { fontFamily: siteFonts[option as SiteFont] } : undefined
              }
            >
              {text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** A small page drawn with the draft: header, a heading, text and a button. */
function SitePreview({ settings }: { settings: SiteSettings }) {
  const { palette, header } = settings;
  return (
    <aside className="site-general__preview" aria-label="Preview">
      <h2>Preview</h2>
      <div
        className="site-general__page"
        style={{ background: palette.background, color: palette.text }}
      >
        <span
          className="site-general__under"
          aria-hidden="true"
          style={{
            background: `linear-gradient(110deg, ${palette.accent}, ${palette.surface})`,
          }}
        />
        <div
          className="site-general__bar"
          data-tone={header.tone}
          data-material={header.material}
          data-align={header.navAlign}
          style={
            {
              "--accent": palette.accent,
              ...headerThemeProperties(settings),
            } as React.CSSProperties
          }
        >
          <strong style={{ fontFamily: siteFonts[settings.headingFont] }}>
            MANOLO SANDRIA
          </strong>
          <nav aria-hidden="true">
            <span className="is-current">Home</span>
            <span>Gallery</span>
            <span>Collections</span>
          </nav>
          <span className="site-general__avatar" style={{ background: palette.accent }} />
        </div>
        <div className="site-general__body">
          <h3 style={{ fontFamily: siteFonts[settings.headingFont] }}>
            Another way of seeing.
          </h3>
          <p style={{ fontFamily: siteFonts[settings.bodyFont] }}>
            Photographs, collections and notes from the road.
          </p>
          <div
            className="site-general__card"
            style={{ background: palette.surface }}
          >
            <span style={{ background: palette.accent }}>Explore</span>
          </div>
        </div>
      </div>
      {header.tone === "auto" && (
        <p className="site-general__hint">
          Automatic: this preview follows your own system; visitors see theirs.
        </p>
      )}
      <p className="site-general__hint">
        {header.hideOnScroll
          ? "Scrolling down, the header leaves; the logo floats on the left with the menu and the account stays on the right."
          : "The header stays at the top while the page scrolls."}
      </p>
    </aside>
  );
}

/** The header without the colors that were reset, so the draft matches a saved one. */
function withoutEmpty(header: SiteSettings["header"]): SiteSettings["header"] {
  const { light, dark, ...rest } = header;
  return { ...rest, ...(light && { light }), ...(dark && { dark }) };
}

/**
 * One tone of the header: a strip painted with it, where its colors come from, and the
 * two colors to pick by hand. A pair too faint to read says so.
 */
function HeaderToneCard({
  tone,
  theme,
  inUse,
  onChange,
  onReset,
}: {
  tone: "light" | "dark";
  theme: HeaderTheme;
  inUse: boolean;
  onChange: (colors: SiteHeaderColors) => void;
  onReset: () => void;
}) {
  const name = tone === "light" ? "Light" : "Dark";
  const ratio = contrastRatio(theme.background, theme.text);
  return (
    <div className="site-general__tone" data-in-use={inUse ? "" : undefined}>
      <div
        className="site-general__tone-strip"
        style={{
          background: theme.background,
          color: theme.text,
          borderColor: theme.line,
        }}
        aria-hidden="true"
      >
        <strong>MS</strong>
        <span>Home</span>
        <span>Gallery</span>
      </div>
      <div className="site-general__tone-head">
        <strong>{name}</strong>
        <small>{theme.custom ? "Picked by hand" : "From the palette"}</small>
        {theme.custom && (
          <button type="button" onClick={onReset}>
            Use the palette&apos;s
          </button>
        )}
      </div>
      <div className="site-general__tone-colors">
        {(["background", "text"] as const).map((key) => (
          <label key={key}>
            <input
              type="color"
              aria-label={`${name} header ${key === "background" ? "ground" : "text"}`}
              value={theme[key]}
              onChange={(event) =>
                onChange({
                  background: theme.background,
                  text: theme.text,
                  [key]: event.target.value,
                })
              }
            />
            <span>
              {key === "background" ? "Ground" : "Text"}
              <code>{theme[key]}</code>
            </span>
          </label>
        ))}
      </div>
      {ratio < headerMinimumContrast && (
        <p className="site-general__warning">
          Contrast {ratio.toFixed(1)}:1: the links may be hard to read (4.5:1 or
          more is recommended).
        </p>
      )}
    </div>
  );
}
