"use client";

import { useState } from "react";
import {
  ALIAS_MAX_LENGTH,
  ALIAS_MIN_LENGTH,
  PUBLIC_NAME_STYLES,
  PublicName,
  PublicNameStyle,
} from "@/src/domain/entities/PublicName";
import { User } from "@/src/domain/entities/User";
import { PublicNameError } from "@/src/domain/errors/PublicNameError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { updatePublicName } from "@/src/infrastructure/sessionServices";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";

const STYLE_LABELS: Record<PublicNameStyle, string> = {
  GIVEN_NAME_INITIAL: "First name and initial",
  FULL_NAME: "Full name from Google",
  ALIAS: "An alias of your own",
};

const STYLE_HINTS: Record<PublicNameStyle, string> = {
  GIVEN_NAME_INITIAL: "Recognisable without giving away your surname.",
  FULL_NAME: "Exactly as it appears on your Google account.",
  ALIAS: `Any name you like, ${ALIAS_MIN_LENGTH} to ${ALIAS_MAX_LENGTH} characters, without links.`,
};

interface PublicNameSettingsProps {
  publicName: PublicName;
  onSaved: (user: User) => void;
}

// How the account signs its comments. Only the forms the API could build from the
// account are offered, plus an alias, which can always be written. The name is fixed on
// each comment when it is sent, so a change applies to new comments only.
export function PublicNameSettings({ publicName, onSaved }: PublicNameSettingsProps) {
  const [style, setStyle] = useState<PublicNameStyle>(
    publicName.choices[publicName.style] ? publicName.style : fallbackStyle(publicName),
  );
  const [alias, setAlias] = useState(publicName.alias ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "status"; text: string } | null>(
    null,
  );

  const styles = PUBLIC_NAME_STYLES.filter(
    (candidate) => candidate === "ALIAS" || publicName.choices[candidate],
  );
  const preview = style === "ALIAS" ? alias.trim() : (publicName.choices[style] ?? "");

  return (
    <section className="upload-card p-6 md:p-8 max-w-3xl space-y-5">
      <h2 className="text-xl font-semibold">Public name</h2>
      <p className="text-sm leading-relaxed text-gray-700">
        Your comments are signed with this name. Changing it only affects comments
        you send from now on.
      </p>
      <form
        aria-label="Public name"
        className="public-name-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          setSaving(true);
          setMessage(null);
          try {
            const trimmed = alias.trim();
            const user = await updatePublicName.execute(
              style,
              style === "ALIAS" ? trimmed : trimmed || null,
            );
            onSaved(user);
            setMessage({ kind: "status", text: "Public name saved." });
          } catch (failure) {
            setMessage({
              kind: "error",
              text:
                failure instanceof PublicNameError
                  ? `An alias needs ${ALIAS_MIN_LENGTH} to ${ALIAS_MAX_LENGTH} characters and cannot include links.`
                  : failure instanceof RateLimitError
                    ? rateLimitMessage(failure)
                    : "Could not save your public name. Try again.",
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset disabled={saving} className="public-name-options">
          <legend className="sr-only">Sign comments as</legend>
          {styles.map((candidate) => (
            <label key={candidate} className="public-name-option">
              <input
                type="radio"
                name="public-name-style"
                checked={style === candidate}
                onChange={() => setStyle(candidate)}
              />
              <span className="public-name-option__text">
                <span className="public-name-option__label">{STYLE_LABELS[candidate]}</span>
                {candidate !== "ALIAS" && (
                  <strong className="public-name-option__name">
                    {publicName.choices[candidate]}
                  </strong>
                )}
                <span className="public-name-option__hint">{STYLE_HINTS[candidate]}</span>
              </span>
            </label>
          ))}
          {style === "ALIAS" && (
            <label className="public-name-alias">
              Alias
              <input
                value={alias}
                minLength={ALIAS_MIN_LENGTH}
                maxLength={ALIAS_MAX_LENGTH}
                required
                placeholder="e.g. Slow Lens"
                onChange={(event) => setAlias(event.target.value)}
              />
            </label>
          )}
        </fieldset>
        <p className="public-name-preview" aria-live="polite">
          <span>Your comments will read</span>
          <strong>{preview || "—"}</strong>
        </p>
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={message.kind === "error" ? "upload-error" : "public-name-saved"}
          >
            {message.text}
          </p>
        )}
        <div>
          <button type="submit" className="upload-primary" disabled={saving}>
            {saving ? "Saving…" : "Save public name"}
          </button>
        </div>
      </form>
    </section>
  );
}

// The form the API would use when the chosen one cannot be built.
function fallbackStyle(publicName: PublicName): PublicNameStyle {
  return PUBLIC_NAME_STYLES.find((candidate) => publicName.choices[candidate]) ?? "ALIAS";
}
