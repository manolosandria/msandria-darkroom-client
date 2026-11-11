"use client";
import { KeyboardEvent, useRef, useState } from "react";
import { PhotoTonality } from "@/src/domain/entities/Photo";
import type { ClassifyPhotoTonality } from "@/src/application/use-cases/ClassifyPhotoTonality";
import { classifyPhotoTonality } from "@/src/infrastructure/photoServices";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import "./choiceMenu.css";

const TONES: { value: PhotoTonality; label: string; icon: React.ReactNode }[] =
  [
    {
      value: "COLOR",
      label: "Color",
      icon: (
        <>
          <circle cx="7.5" cy="8" r="4.5" fill="#d9534f" opacity="0.85" />
          <circle cx="12.5" cy="8" r="4.5" fill="#3f8fd2" opacity="0.85" />
          <circle cx="10" cy="12.5" r="4.5" fill="#5cb85c" opacity="0.85" />
        </>
      ),
    },
    {
      value: "MONOCHROME",
      label: "Black & white",
      icon: (
        <>
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" />
          <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
        </>
      ),
    },
  ];

/**
 * Colour or black and white, as Gallery's Tone filter reads it. The API measures it on
 * upload; this corrects it. A photograph not classified yet has neither chosen.
 */
export function PhotoTonalityField({
  value,
  onChange,
  disabled = false,
}: {
  value: PhotoTonality | null;
  onChange: (value: PhotoTonality) => void;
  disabled?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!by) return;
    event.preventDefault();
    const index = TONES.findIndex((tone) => tone.value === value);
    const next = TONES[(Math.max(index, 0) + by + TONES.length) % TONES.length];
    onChange(next.value);
    row.current
      ?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)
      ?.focus();
  }
  return (
    <div className="segmented-choice">
      <span className="segmented-choice__label">Tone</span>
      <div
        ref={row}
        role="radiogroup"
        aria-label="Tone"
        className="segmented-choice__row"
        onKeyDown={onKeyDown}
      >
        {TONES.map((tone, index) => (
          <button
            key={tone.value}
            type="button"
            role="radio"
            data-value={tone.value}
            aria-checked={tone.value === value}
            aria-label={tone.label}
            title={tone.label}
            // Unclassified, the first one takes the focus.
            tabIndex={tone.value === value || (!value && index === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => tone.value !== value && onChange(tone.value)}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              {tone.icon}
            </svg>
          </button>
        ))}
      </div>
      <span className="segmented-choice__current">
        {TONES.find((tone) => tone.value === value)?.label ??
          "Not classified yet"}
      </span>
    </div>
  );
}

/**
 * Photographs uploaded before the API measured their tone are classified here, a batch
 * at a time, until none are left or a batch classifies nothing (files that cannot be
 * read stay pending and are counted).
 */
export function TonalityBackfill({
  pending,
  onDone,
  classify = classifyPhotoTonality,
}: {
  pending: number;
  onDone: () => void;
  classify?: Pick<ClassifyPhotoTonality, "execute">;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{
    classified: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState("");
  async function run() {
    setRunning(true);
    setError("");
    let classified = 0;
    let failed = 0;
    try {
      for (;;) {
        const batch = await classify.execute();
        classified += batch.classified;
        failed = batch.failed;
        setProgress({ classified, failed });
        if (batch.remaining === 0 || batch.classified === 0) break;
      }
      onDone();
    } catch (failure) {
      setError(apiFailureMessage(failure));
    } finally {
      setRunning(false);
    }
  }
  if (pending === 0 && !progress) return null;
  return (
    <p className="photo-studio__alert" role="status">
      <span aria-hidden="true">◐</span>
      <span>
        {running ? (
          <strong>Classifying… {progress?.classified ?? 0} done</strong>
        ) : progress ? (
          <>
            <strong>
              {progress.classified}{" "}
              {progress.classified === 1 ? "photo" : "photos"} classified
            </strong>
            {progress.failed > 0 &&
              ` — ${progress.failed} could not be read and stay pending`}
          </>
        ) : (
          <>
            <strong>
              {pending} {pending === 1 ? "photo is" : "photos are"} not
              classified
            </strong>{" "}
            as color or black and white, so Gallery&apos;s Tone filter leaves{" "}
            {pending === 1 ? "it" : "them"} out.
          </>
        )}
        {error && <> {error}</>}
      </span>
      {pending > 0 && (
        <button type="button" onClick={run} disabled={running}>
          {running ? "Classifying…" : "Classify them"}
        </button>
      )}
    </p>
  );
}
