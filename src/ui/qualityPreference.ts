import {
  DEFAULT_PHOTO_QUALITY,
  PhotoQuality,
  isPhotoQuality,
  qualityForScreen,
} from "@/src/domain/entities/PhotoQuality";

const STORAGE_KEY = "photoQuality";
const listeners = new Set<() => void>();

// Storage can be missing or throw (private windows, blocked site data), and the viewer
// has to work without it: the preference then lasts only until the page closes.
let fallback: PhotoQuality | null = null;

// Without a choice, the screen decides: a phone does not download the 1920 px file.
function screenDefault(): PhotoQuality {
  try {
    return qualityForScreen(window.innerWidth, window.devicePixelRatio || 1);
  } catch {
    return DEFAULT_PHOTO_QUALITY;
  }
}

export function readQuality(): PhotoQuality {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isPhotoQuality(stored)) return stored;
  } catch {
    return fallback ?? screenDefault();
  }
  return fallback ?? screenDefault();
}

export function writeQuality(quality: PhotoQuality) {
  fallback = quality;
  try {
    window.localStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeQuality(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
