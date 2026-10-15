"use client";
import { Photo } from "@/src/domain/entities/Photo";
import { photoDetails } from "@/src/ui/photoDetails";

interface PhotoInfoPanelProps {
  photo: Photo;
  className?: string;
  onClose: () => void;
}

// The viewer's side panel, top to bottom: title, description and the details recorded
// when the photo was taken. Ratings and comments will follow below them.
export function PhotoInfoPanel({ photo, className = "", onClose }: PhotoInfoPanelProps) {
  const description = photo.getDescription();
  const details = photoDetails(photo.getMetadata());

  return (
    <aside
      aria-label="Photo information"
      data-viewer-panel
      className={`photo-viewer__panel ${className}`}
    >
      <button
        type="button"
        aria-label="Close photo information"
        onClick={onClose}
        className="photo-viewer__control absolute right-4 top-4"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <h2 className="photo-viewer__panel-title">{photo.getTitle()}</h2>
      {description && <p className="mt-4 whitespace-pre-line leading-relaxed text-neutral-300">{description}</p>}

      <section aria-label="Details" className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Details</h3>
        {details.length > 0 ? (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {details.map(({ label, value }) => (
              <div key={label} className="contents">
                <dt className="text-neutral-400">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-neutral-400">No camera details were recorded for this photo.</p>
        )}
      </section>
    </aside>
  );
}
