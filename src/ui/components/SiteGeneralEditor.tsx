"use client";
import "./paletteStudio.css";
import "./siteGeneral.css";
import { useEffect, useRef, useState } from "react";
import {
  defaultSiteSettings,
  SiteFont,
  SiteHeaderStyle,
  SiteNavAlign,
  SiteSettings,
  siteFonts,
} from "@/src/domain/entities/SiteSettings";
import { defaultGalleryPalettes } from "@/src/domain/entities/GallerySettings";
import { manageSiteSettings } from "@/src/infrastructure/siteSettingsServices";
import type { ManageSiteSettings } from "@/src/application/use-cases/ManageSiteSettings";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { EditorActions } from "./EditorActions";
import { useSiteSettings } from "./SiteSettingsProvider";

const headerStyles: [SiteHeaderStyle, string][] = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["glass", "Frosted glass"],
];
const navAligns: [SiteNavAlign, string][] = [
  ["start", "Beside the logo"],
  ["center", "Centered"],
  ["end", "Towards the account"],
];
const fonts: [SiteFont, string][] = [
  ["serif", "Serif"],
  ["sans", "Sans"],
  ["mono", "Mono"],
];
const paletteKeys = ["background", "text", "accent", "surface"] as const;

/**
 * Curator → Sections → General: the look every page shares. The header's style,
 * whether it leaves on scroll and where its links sit, the fonts and the main
 * palette. Nothing changes on the site until it is saved.
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
      const loaded = { ...defaultSiteSettings, ...(await service.get()) };
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
  useUnsavedEditor(dirty, {
    label: "General",
    save,
    discard: () => saved && setDraft(saved),
  });

  const change = (next: Partial<SiteSettings>) => {
    setDraft((previous) => ({ ...previous, ...next }));
    setNotice("");
  };
  const changeHeader = (next: Partial<SiteSettings["header"]>) =>
    setDraft((previous) => ({
      ...previous,
      header: { ...previous.header, ...next },
    }));

  return (
    <div className="palette-manager site-general">
      <header>
        <p className="banner-editor__eyebrow">CURATOR / GENERAL</p>
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
              await save();
            }}
          >
            <fieldset disabled={busy}>
              <legend>Header</legend>
              <Choices
                name="header-style"
                label="Style"
                options={headerStyles}
                value={draft.header.style}
                onChange={(style) => changeHeader({ style })}
              />
              <Choices
                name="nav-align"
                label="Links"
                options={navAligns}
                value={draft.header.navAlign}
                onChange={(navAlign) => changeHeader({ navAlign })}
              />
              <label className="site-general__switch">
                <input
                  type="checkbox"
                  checked={draft.header.hideOnScroll}
                  onChange={(event) =>
                    changeHeader({ hideOnScroll: event.target.checked })
                  }
                />
                Hide it on scroll and keep the floating logo with the menu
              </label>
              <p className="site-general__hint">
                Off, the header stays fixed at the top while the page scrolls.
              </p>
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
        <div
          className="site-general__bar"
          data-style={header.style}
          data-align={header.navAlign}
          style={{ "--accent": palette.accent } as React.CSSProperties}
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
      <p className="site-general__hint">
        {header.hideOnScroll
          ? "Scrolling down, the header leaves; the logo floats on the left with the menu and the account stays on the right."
          : "The header stays at the top while the page scrolls."}
      </p>
    </aside>
  );
}
