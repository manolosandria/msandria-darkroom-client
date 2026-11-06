"use client";
import { useEffect, useRef, useState } from "react";
import type { CuratorSection } from "./curatorSections";

// Curator lives in the page; its pill lives in the header's corner. They talk through
// two window events: Curator announces the tab it shows, and the pill asks it to show
// another one.
const SECTION_EVENT = "curator:section";
const SHOW_EVENT = "curator:show";

// The tab Curator shows right now, for a pill that mounts after the announcement.
let current: CuratorSection | null = null;

/** Curator says which tab it shows; `null` once it unmounts. */
export function announceCuratorSection(section: CuratorSection | null) {
  current = section;
  window.dispatchEvent(new CustomEvent(SECTION_EVENT, { detail: section }));
}

/** Asks the open Curator to show a tab. */
export function requestCuratorSection(section: CuratorSection) {
  window.dispatchEvent(new CustomEvent(SHOW_EVENT, { detail: section }));
}

/** The tab Curator shows, or `null` while no Curator is open. */
export function useCuratorSection() {
  const [section, setSection] = useState<CuratorSection | null>(current);
  useEffect(() => {
    const update = (event: Event) =>
      setSection((event as CustomEvent<CuratorSection | null>).detail);
    window.addEventListener(SECTION_EVENT, update);
    // An announcement may have come between the first render and this effect.
    queueMicrotask(() => setSection(current));
    return () => window.removeEventListener(SECTION_EVENT, update);
  }, []);
  return section;
}

/** Curator's side: shows whatever tab the pill asks for. */
export function useCuratorRequests(show: (section: CuratorSection) => void) {
  // The latest `show`, read when a request arrives, so listening never churns.
  const latest = useRef(show);
  useEffect(() => {
    latest.current = show;
  });
  useEffect(() => {
    const handle = (event: Event) =>
      latest.current((event as CustomEvent<CuratorSection>).detail);
    window.addEventListener(SHOW_EVENT, handle);
    return () => window.removeEventListener(SHOW_EVENT, handle);
  }, []);
}

// Whether Curator's own row of tabs shows. Folded, the pill offers to bring it back.
const TABS_EVENT = "curator:tabs";
const SHOW_TABS_EVENT = "curator:show-tabs";
let tabsShown = true;

/** Curator says whether its row of tabs shows. */
export function announceCuratorTabs(shown: boolean) {
  tabsShown = shown;
  window.dispatchEvent(new CustomEvent(TABS_EVENT, { detail: shown }));
}

/** Asks the open Curator to show its row of tabs. */
export function requestCuratorTabs() {
  window.dispatchEvent(new Event(SHOW_TABS_EVENT));
}

/** Whether Curator's row of tabs shows. */
export function useCuratorTabsShown() {
  const [shown, setShown] = useState(tabsShown);
  useEffect(() => {
    const update = (event: Event) =>
      setShown((event as CustomEvent<boolean>).detail);
    window.addEventListener(TABS_EVENT, update);
    queueMicrotask(() => setShown(tabsShown));
    return () => window.removeEventListener(TABS_EVENT, update);
  }, []);
  return shown;
}

/** Curator's side: shows its row of tabs when the pill asks. */
export function useCuratorTabsRequests(show: () => void) {
  const latest = useRef(show);
  useEffect(() => {
    latest.current = show;
  });
  useEffect(() => {
    const handle = () => latest.current();
    window.addEventListener(SHOW_TABS_EVENT, handle);
    return () => window.removeEventListener(SHOW_TABS_EVENT, handle);
  }, []);
}
