"use client";

import { useState } from "react";
import UploadPanel from "./UploadPanel";
import ManagePhotos from "./ManagePhotos";
import ManageCollections from "./ManageCollections";
import CommentModeration from "./CommentModeration";
import ContactInbox from "./ContactInbox";
import { useCuratorNotifications } from "./CuratorNotifications";

const sections = [
  "Upload",
  "Photos",
  "Collections",
  "Moderation",
  "Inbox",
] as const;
type Section = (typeof sections)[number];

export default function Curator() {
  const [section, setSection] = useState<Section>("Upload");
  const [visited, setVisited] = useState<Section[]>(["Upload"]);
  const counts = useCuratorNotifications();
  return (
    <div className="curator-workspace">
      <nav aria-label="Curator sections" className="curator-tabs">
        {sections.map((name) => {
          const count =
            name === "Moderation"
              ? counts?.comments
              : name === "Inbox"
                ? counts?.inbox
                : 0;
          return (
            <button
              key={name}
              type="button"
              aria-current={section === name ? "page" : undefined}
              onClick={() => {
                setSection(name);
                setVisited((previous) =>
                  previous.includes(name) ? previous : [...previous, name],
                );
              }}
            >
              {name}
              {!!count && <span className="curator-badge">{count}</span>}
            </button>
          );
        })}
      </nav>
      <div hidden={section !== "Upload"}>
        <UploadPanel />
      </div>
      {visited.includes("Photos") && (
        <div hidden={section !== "Photos"}>
          <ManagePhotos />
        </div>
      )}
      {visited.includes("Collections") && (
        <div hidden={section !== "Collections"}>
          <ManageCollections />
        </div>
      )}
      {section === "Moderation" && <CommentModeration />}
      {section === "Inbox" && <ContactInbox />}
    </div>
  );
}
