"use client";
import { useState } from "react";
import {
  ContactSettings,
  defaultContactSettings,
} from "@/src/domain/entities/ContactSettings";
import { manageContactSettings } from "@/src/infrastructure/contactSettingsServices";
import { useSettingsDocument } from "@/src/ui/hooks/useSettingsDocument";
import { EditorActions } from "./EditorActions";
import { DeviceFrame, DeviceSwitch, PreviewDevice } from "./DeviceSwitch";
import ContactForm from "./ContactForm";
import "./contactSettings.css";

export default function ContactEditor() {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const {
    saved,
    draft,
    edit,
    busy,
    error,
    notice,
    dirty,
    cancel,
    reload,
    review,
  } = useSettingsDocument<ContactSettings>({
    initial: defaultContactSettings,
    read: () => manageContactSettings.get(),
    write: (value) => manageContactSettings.save(value),
    label: "Contact",
    savedNotice: "Contact settings saved.",
    cancelPrompt: ["Cancel changes?", "Return to the saved Contact settings?"],
    reloadPrompt: [
      "Reload Contact?",
      "Discard this draft and load the saved settings?",
    ],
  });
  const change = (next: Partial<ContactSettings>) =>
    edit((previous) => ({ ...previous, ...next }));
  return (
    <section className="contact-editor">
      <header>
        <div>
          <h1>A place to connect.</h1>
          <p>Personalize your Contact page.</p>
        </div>
        <EditorActions
          form="contact-settings"
          busy={busy}
          dirty={dirty}
          canSave={!!saved}
          saveLabel="Save Contact"
          onCancel={cancel}
        />
      </header>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={reload}>
            Reload state
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="contact-editor__layout">
        <form
          id="contact-settings"
          onSubmit={async (event) => {
            event.preventDefault();
            await review();
          }}
        >
          <fieldset disabled={busy || !saved} className="studio-card">
            <legend>Contact page</legend>
            {(
              [
                ["eyebrow", "Eyebrow", 80],
                ["title", "Title", 160],
                ["description", "Description", 1000],
                ["buttonText", "Button", 60],
              ] as const
            ).map(([key, label, max]) => (
              <label key={key}>
                {label}
                <input
                  value={draft[key]}
                  maxLength={max}
                  required={key === "title" || key === "buttonText"}
                  onChange={(event) => change({ [key]: event.target.value })}
                />
              </label>
            ))}
            <label>
              Layout
              <select
                value={draft.layout}
                onChange={(event) =>
                  change({
                    layout: event.target.value as ContactSettings["layout"],
                  })
                }
              >
                <option value="split">Side by side</option>
                <option value="stacked">Stacked</option>
              </select>
            </label>
            <label>
              Heading font
              <select
                value={draft.headingFont}
                onChange={(event) =>
                  change({
                    headingFont: event.target
                      .value as ContactSettings["headingFont"],
                  })
                }
              >
                <option value="serif">Serif</option>
                <option value="sans">Sans</option>
                <option value="mono">Mono</option>
              </select>
            </label>
            <label className="contact-editor__check">
              <input
                type="checkbox"
                checked={draft.showFacts}
                onChange={(event) =>
                  change({ showFacts: event.target.checked })
                }
              />
              Show contact notes
            </label>
            {(["background", "surface", "text", "accent"] as const).map(
              (key) => (
                <label key={key} className="contact-editor__color">
                  {key}
                  <input
                    type="color"
                    aria-label={`${key} color`}
                    value={draft[key]}
                    onChange={(event) => change({ [key]: event.target.value })}
                  />
                </label>
              ),
            )}
            <button
              type="button"
              onClick={() =>
                change({ ...defaultContactSettings, version: draft.version })
              }
            >
              Reset appearance
            </button>
          </fieldset>
        </form>
        <div className="contact-editor__preview">
          <DeviceSwitch value={device} onChange={setDevice} />
          <DeviceFrame device={device}>
            <ContactForm settings={draft} preview />
          </DeviceFrame>
        </div>
      </div>
    </section>
  );
}
