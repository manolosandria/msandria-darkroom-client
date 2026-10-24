"use client";
import { useEffect, useState } from "react";
import { Photo } from "@/src/domain/entities/Photo";
import { HomeBanner } from "@/src/domain/entities/HomeBanner";
import { Highlight } from "@/src/domain/entities/PhotoHighlights";
import { BannerSlideLink } from "./BannerSlideLink";
import { HighlightEditor } from "./HighlightEditor";
import { ResolutionBadge } from "./ResolutionBadge";
import { VisualChoice } from "./VisualChoice";
import { getPhotoById, savePhoto } from "@/src/infrastructure/photoServices";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { CroppedSlide } from "./HomePage";
export function BannerPhotoSettings({
  photo,
  banner,
  onChange,
  onClose,
  onUpdated,
  display,
  onDisplayChange,
  onDirty,
  onSlideChange,
}: {
  photo: Photo;
  banner: HomeBanner;
  onChange: (value: NonNullable<HomeBanner["photoCrops"]>) => void;
  onClose: () => void;
  onUpdated?: (photo: Photo) => void;
  display?: "desktop" | "mobile";
  onSlideChange?: (slides: NonNullable<HomeBanner["slides"]>) => void;
  onDirty?: (dirty: boolean) => void;
  onDisplayChange?: (display: "desktop" | "mobile") => void;
}) {
  const [localDevice, setDevice] = useState<"desktop" | "mobile">("desktop");
  const device = display ?? localDevice;
  const [ratio, setRatio] = useState("all");
  const [highlights, setHighlights] = useState(photo.getHighlights());
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { confirm } = useEditingWorkspace();
  const dirty =
    JSON.stringify(highlights) !== JSON.stringify(photo.getHighlights());
  useEffect(() => {
    onDirty?.(dirty);
    return () => onDirty?.(false);
  }, [dirty, onDirty]);
  async function save() {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const original = photo;
      const updated = new Photo({
        id: original.getId(),
        version: original.getVersion(),
        title: original.getTitle(),
        description: original.getDescription(),
        width: original.getWidth(),
        height: original.getHeight(),
        renditions: original.getRenditions(),
        frame: original.getFrame(),
        titlePosition: original.getTitlePosition(),
        metadata: original.getMetadata(),
        createdAt: original.getCreatedAt(),
        ...original.getClassification(),
        highlights,
      });
      await savePhoto.execute(updated, original);
      const fresh = await getPhotoById.execute(photo.getId());
      if (!fresh) throw new Error("Photo could not be reloaded.");
      onUpdated?.(fresh);
      setHighlights(fresh.getHighlights());
      setEditing(false);
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save highlights.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  useUnsavedEditor(dirty, {
    label: "Home photo highlights",
    save,
    discard: () => setHighlights(photo.getHighlights()),
  });
  const full = { x: 0, y: 0, width: 1, height: 1 };
  const crops: { id: string; name: string; crop: Highlight }[] = [
    { id: "full", name: "Full photograph", crop: full },
    ...(["landscape", "portrait", "square"] as const).flatMap((id) => {
      const crop = photo.getHighlights()[id];
      return crop ? [{ id, name: id, crop }] : [];
    }),
    ...(photo.getHighlights().custom ?? []).map((item) => ({
      id: `custom:${item.id}`,
      name: item.name,
      crop: item.crop,
    })),
  ];
  const chosen = banner.photoCrops?.find(
    (item) => item.photoId === photo.getId(),
  );
  const selected =
    chosen?.[device] ??
    (device === "desktop"
      ? (banner.desktopCrop ?? "landscape")
      : (banner.mobileCrop ?? "portrait"));
  return (
    <section
      className="banner-photo-settings"
      aria-label="Photograph banner settings"
    >
      <header>
        <h2>{photo.getTitle()}</h2>
        <button
          type="button"
          onClick={async () => {
            if (
              !dirty ||
              (await confirm(
                "Discard highlight changes?",
                "Your unsaved photo highlight edits will be discarded.",
              ))
            )
              onClose();
          }}
        >
          Close photo settings
        </button>
      </header>
      {onSlideChange && (
        <BannerSlideLink
          photoId={photo.getId()}
          title={photo.getTitle()}
          banner={banner}
          onChange={onSlideChange}
        />
      )}
      <p>
        Choose the exact saved highlight for this photograph. Changes apply when
        you save the banner.
      </p>
      <div
        className="display-choice"
        role="group"
        aria-label="Photo target display"
      >
        {(["desktop", "mobile"] as const).map((value) => (
          <VisualChoice
            key={value}
            label={value === "desktop" ? "Desktop" : "Mobile"}
            icon={value === "desktop" ? "▰" : "▯"}
            active={device === value}
            onClick={() => {
              setDevice(value);
              onDisplayChange?.(value);
            }}
          />
        ))}
      </div>
      <div className="display-choice" role="group" aria-label="Highlight ratio">
        {[
          ["all", "All ratios", "▦"],
          ["1.5", "Landscape 3:2", "▭"],
          ["1", "Square 1:1", "□"],
          ["0.6666666666666666", "Portrait 2:3", "▯"],
        ].map(([value, label, icon]) => (
          <VisualChoice
            key={value}
            label={label}
            icon={icon}
            active={ratio === value}
            onClick={() => setRatio(value)}
          />
        ))}
      </div>
      <p>
        Editing:{" "}
        <strong>
          {device === "desktop" ? "Desktop monitor" : "Mobile phone"}
        </strong>{" "}
        ·{" "}
        {ratio === "all"
          ? "All highlight ratios"
          : `Ratio ${Number(ratio).toFixed(2)}:1`}
      </p>
      <button
        type="button"
        onClick={() => setEditing(!editing)}
        aria-expanded={editing}
      >
        ✂ Edit photo highlights
      </button>
      {error && (
        <p role="alert">
          {error} Your draft is preserved.{" "}
          <button
            type="button"
            onClick={async () => {
              if (
                await confirm(
                  "Reload photo?",
                  "Discard the highlight draft and reload the latest version?",
                )
              ) {
                const fresh = await getPhotoById.execute(photo.getId());
                if (fresh) {
                  onUpdated?.(fresh);
                  setHighlights(fresh.getHighlights());
                  setError("");
                }
              }
            }}
          >
            Reload photo
          </button>
        </p>
      )}
      {editing && (
        <div className="home-highlight-editor">
          <HighlightEditor
            src={photo.getRenditions().at(-1)!.url}
            width={photo.getWidth()}
            height={photo.getHeight()}
            value={highlights}
            onChange={setHighlights}
            disabled={busy}
          />
          <ResolutionBadge
            width={photo.getWidth()}
            height={photo.getHeight()}
          />
          <button type="button" disabled={busy || !dirty} onClick={save}>
            {busy ? "Saving…" : "Save photo highlights"}
          </button>
          <p>
            Saving updates this photograph everywhere. Save banner applies only
            its highlight selection.
          </p>
        </div>
      )}
      {!crops.some(
        (item) =>
          ratio === "all" ||
          Math.abs(
            (photo.getAspectRatio() * item.crop.width) / item.crop.height -
              Number(ratio),
          ) < 0.025,
      ) && (
        <p>
          No highlights match this ratio. Choose All ratios or create one with
          Edit photo highlights.
        </p>
      )}
      <div className="banner-photo-settings__choices">
        {crops
          .filter(
            (item) =>
              ratio === "all" ||
              Math.abs(
                (photo.getAspectRatio() * item.crop.width) / item.crop.height -
                  Number(ratio),
              ) < 0.025,
          )
          .map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={selected === item.id}
              onClick={() => {
                const next = {
                  photoId: photo.getId(),
                  desktop: chosen?.desktop ?? banner.desktopCrop ?? "landscape",
                  mobile: chosen?.mobile ?? banner.mobileCrop ?? "portrait",
                  [device]: item.id,
                };
                onChange(
                  [
                    ...(banner.photoCrops ?? []).filter(
                      (row) => row.photoId !== photo.getId(),
                    ),
                    next,
                  ].slice(-8),
                );
              }}
            >
              <span className="banner-photo-settings__thumbnail">
                <CroppedSlide
                  photo={photo}
                  cropName={item.id}
                  device="desktop"
                />
              </span>
              <strong>{item.name}</strong>
              <span>
                {Math.round(photo.getWidth() * item.crop.width)} ×{" "}
                {Math.round(photo.getHeight() * item.crop.height)} px ·{" "}
                {(
                  (photo.getAspectRatio() * item.crop.width) /
                  item.crop.height
                ).toFixed(2)}
                :1
              </span>
            </button>
          ))}
      </div>
    </section>
  );
}
