// What the visitor read a moment ago (a photo's detail, a Gallery page), kept in memory
// for this tab so opening it again or coming back shows it at once. It is only a first
// paint: every read is asked again of the API, which decides access, so a photo made
// private in between disappears as soon as that answer arrives. Nothing is written to
// storage, and the whole cache is dropped when the signed-in account changes.

const LIMIT = 60;
const reads = new Map<string, unknown>();

export function recentRead<T>(key: string): T | undefined {
  return reads.get(key) as T | undefined;
}

export function rememberRead<T>(key: string, value: T) {
  // Refreshed entries move to the end; the oldest leave first.
  reads.delete(key);
  reads.set(key, value);
  while (reads.size > LIMIT) reads.delete(reads.keys().next().value!);
}

export function forgetRead(key: string) {
  reads.delete(key);
}

export function forgetAllReads() {
  reads.clear();
}
