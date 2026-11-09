"use client";

import type { UploadItem } from "./UploadPanel";
import { ClassificationCatalogBoundary, useClassificationCatalog } from "./ClassificationCatalog";

const VISIBILITY = {
  PUBLIC: "Public · Gallery",
  COLLECTIONS_ONLY: "Only in collections",
  POSTS_ONLY: "Only in posts",
  PRIVATE: "Private",
  SELECT: "Select · Reserved access",
};

export function UploadReview(props: { item: UploadItem; forPost: boolean; onEdit: (step: number) => void }) {
  return <ClassificationCatalogBoundary><Review {...props} /></ClassificationCatalogBoundary>;
}

function Review({ item, forPost, onEdit }: { item: UploadItem; forPost: boolean; onEdit: (step: number) => void }) {
  const { catalog } = useClassificationCatalog();
  const crops = [
    ...(["square", "landscape", "portrait"] as const).flatMap((kind) => item.highlights[kind] ? [`${kind[0].toUpperCase()}${kind.slice(1)} · Main`] : []),
    ...(item.highlights.custom ?? []).map((crop) => `${crop.name} · ${crop.shape ?? "Free"}`),
  ];
  const collections = item.classification.collections.map((entry) => {
    const title = catalog?.collections.find((collection) => collection.id === entry.id)?.title ?? "Collection";
    return `${title} · position ${entry.position}`;
  });
  const viewName = (key: string) => key.startsWith("custom:")
    ? item.highlights.custom?.find((crop) => `custom:${crop.id}` === key)?.name ?? "Named highlight"
    : key[0].toUpperCase() + key.slice(1);
  const views = (target: "gallery" | "home") => {
    const selected = item.highlights.presentation?.[target] ?? ["original"];
    return selected.length ? selected.map(viewName).join(", ") : "Not offered";
  };
  const layoutNames: Record<string, string> = { uniform: "Grid", random: "Random", justified: "Original" };
  const galleryLayouts = item.highlights.presentation?.galleryRules
    ?.filter((rule) => rule.views.length)
    .map((rule) => `${layoutNames[rule.layout] ?? rule.layout} · ${viewName(rule.aspect)}: ${rule.views.map(viewName).join(", ")}`)
    .join("; ");
  const groups = [
    { title: "The photograph", step: 0, rows: [
      ["Title", item.title || "Title required"],
      ["Description", item.description.trim() || "No description"],
    ] },
    { title: "Appearance", step: 1, rows: [
      ["File border", item.trim ? `Removed · left ${Math.round(item.trim.x * 100)}%, top ${Math.round(item.trim.y * 100)}%, kept ${Math.round(item.trim.width * 100)}% × ${Math.round(item.trim.height * 100)}%` : "Keep original edges"],
      ["Frame", item.frame ? `${item.frame.color.toUpperCase()} · sides ${item.frame.leftRight}% · top/bottom ${item.frame.topBottom}%` : "No frame"],
    ] },
    { title: "Highlights & display", step: 2, rows: [
      ["Highlights", crops.length ? crops.join(", ") : "Original photo only"],
      ["Gallery views", views("gallery")],
      ["Home views", views("home")],
      ...(item.highlights.presentation?.galleryRules ? [["Gallery layouts", galleryLayouts || "No layouts enabled"]] : []),
    ] },
    { title: "Where it appears", step: 3, rows: [
      ["Visibility", VISIBILITY[item.classification.visibility]],
      ...(!forPost ? [
        ["Categories", item.classification.categoryNames.join(", ") || "No categories"],
        ["Collections", collections.join(", ") || "No collections assigned"],
        ["Variant", item.variantTargetId ? "Link to the chosen photograph" : "Independent photograph"],
      ] : []),
    ] },
  ];
  return (
    <section className="upload-review" aria-label="Upload summary">
      <div className="upload-review-heading">
        <span className="upload-eyebrow">ONE LAST LOOK</span>
        <h3>{item.published ? "Your uploaded photograph" : "Review your photograph"}</h3>
        <p>{item.published ? "These are the settings used for this upload." : "Check your choices, or jump back to adjust a detail."}</p>
      </div>
      {groups.map((group) => <section className="upload-review-group" key={group.title}>
        <header><h4>{group.title}</h4><button type="button" onClick={() => onEdit(group.step)} aria-label={`Edit ${group.title.toLowerCase()}`}>View / edit ↗</button></header>
        <dl>{group.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>)}
    </section>
  );
}
