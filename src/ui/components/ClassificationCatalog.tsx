"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { manageCatalog } from "@/src/infrastructure/catalogServices";

const Context = createContext<{
  catalog: Catalog | null; failed: boolean; load: () => Promise<void>; reload: () => Promise<void>;
} | null>(null);

export function ClassificationCatalogBoundary({ children }: { children: React.ReactNode }) {
  return useContext(Context) ? children : <CatalogProvider>{children}</CatalogProvider>;
}

function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const pending = useRef<Promise<void> | null>(null);
  const loaded = useRef(false);
  const used = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    used.current = true;
    if (pending.current) return pending.current;
    if (loaded.current) return;
    const current = generation.current;
    const request = manageCatalog.load().then(value => {
      if (current !== generation.current) return;
      loaded.current = true; setCatalog(value); setFailed(false);
    }, () => {
      if (current === generation.current) setFailed(true);
    }).finally(() => { if (current === generation.current) pending.current = null; });
    pending.current = request;
    return request;
  }, []);
  const invalidate = useCallback(() => {
    generation.current++; loaded.current = false; pending.current = null;
  }, []);
  const reload = useCallback(() => {
    invalidate();
    return load();
  }, [load, invalidate]);
  useEffect(() => {
    const refresh = () => { if (used.current) void reload(); };
    window.addEventListener("curator:catalog-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      invalidate();
      window.removeEventListener("curator:catalog-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [reload, invalidate]);
  return <Context.Provider value={{ catalog, failed, load, reload }}>{children}</Context.Provider>;
}

export function useClassificationCatalog() {
  const context = useContext(Context);
  const load = context?.load;
  useEffect(() => { void load?.(); }, [load]);
  if (!context) throw new Error("A classification catalog is required.");
  return context;
}
