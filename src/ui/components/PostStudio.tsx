"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Photo, PhotoVisibility } from "@/src/domain/entities/Photo";
import {
  MAX_POST_BLOCKS,
  MAX_POST_TAGS,
  Post,
  PostBlock,
  PostDraft,
  PostStatus,
  PostTextStyle,
  draftOf,
  isScheduled,
  normalizeTag,
  publishingProblem,
} from "@/src/domain/entities/Post";
import { PostConflictError } from "@/src/domain/errors/PostConflictError";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { managePosts } from "@/src/infrastructure/postServices";
import {
  getManagedPhotos,
  uploadPhoto,
} from "@/src/infrastructure/photoServices";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { useLiveSort } from "@/src/ui/hooks/useLiveSort";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { useClassificationCatalog } from "./ClassificationCatalog";
import { EmptyState } from "./EmptyState";
import { PhotoImage } from "./PhotoImage";
import { PhotoPicker } from "./PhotoPicker";
import { PostArticle } from "./PostArticle";
import { PostIcon } from "./PostIcon";
import { EditorActions } from "./EditorActions";
import { DeviceFrame, DeviceSwitch, PreviewDevice } from "./DeviceSwitch";
import { TEXT_STYLE_LABELS, TextStyleChoice } from "./TextStyleChoice";
import { PostDatePicker } from "./PostDatePicker";
import { UploadCard, UploadItem } from "./UploadPanel";
import { publicClassification } from "./PhotoClassificationFields";
import "./catalogStudio.css";
import "./postStudio.css";

export type PostStudioPorts = {
  posts: Pick<typeof managePosts, "all" | "create" | "update" | "remove">;
  photos: Pick<typeof getManagedPhotos, "execute">;
  upload: Pick<typeof uploadPhoto, "execute">;
};

const defaultPorts: PostStudioPorts = {
  posts: managePosts,
  photos: getManagedPhotos,
  upload: uploadPhoto,
};

// Each block carries a key of its own while edited, so the list can be dragged into a
// new order and React keeps every field with its block.
type EditorBlock =
  | { key: string; kind: "TEXT"; text: string; style: PostTextStyle }
  | { key: string; kind: "PHOTO"; photoId: string; caption: string };
type EditorDraft = {
  title: string;
  status: PostStatus;
  // A `datetime-local` value in the curator's own time; empty means "when published".
  publishedAt: string;
  tags: string[];
  blocks: EditorBlock[];
};

// Named as in collections, so a block's style reads the same everywhere.
const STYLE_LABELS: Record<PostTextStyle, string> = TEXT_STYLE_LABELS;

// Photos that a published post can show. Private and select ones never can; a
// collections-only one can while it is in a collection, which the API checks.
const POSTABLE: PhotoVisibility[] = [
  "PUBLIC",
  "COLLECTIONS_ONLY",
  "POSTS_ONLY",
];

let nextKey = 0;
const newKey = () => `block-${++nextKey}`;

const pad = (value: number) => String(value).padStart(2, "0");
export function toLocalInput(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function editorDraftOf(post: Post | null): EditorDraft {
  if (!post)
    return {
      title: "",
      status: "DRAFT",
      publishedAt: "",
      tags: [],
      blocks: [],
    };
  const draft = draftOf(post);
  return {
    title: draft.title,
    status: draft.status,
    publishedAt: toLocalInput(post.publishedAt),
    tags: draft.tags,
    blocks: draft.blocks.map((block) => ({ ...block, key: newKey() })),
  };
}

export function postDraftOf(draft: EditorDraft): PostDraft {
  const date = draft.publishedAt ? new Date(draft.publishedAt) : null;
  return {
    title: draft.title.trim(),
    status: draft.status,
    publishedAt:
      date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    tags: draft.tags,
    blocks: draft.blocks.map((block) =>
      block.kind === "TEXT"
        ? { kind: "TEXT", text: block.text, style: block.style }
        : {
            kind: "PHOTO",
            photoId: block.photoId,
            caption: block.caption.trim(),
          },
    ),
  };
}

const sameDraft = (a: EditorDraft, b: EditorDraft) =>
  JSON.stringify(postDraftOf(a)) === JSON.stringify(postDraftOf(b));

const fileTitle = (file: File) =>
  file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || "Untitled";

/**
 * Curator → Posts: Home's journal. A list of every post (drafts and scheduled ones
 * marked) beside the editor: title, status and publication date, tags, and the body as
 * blocks of text and photos that reorder by dragging their grip or with the arrows.
 * Photos come from the library or are uploaded here, to the gallery as well or for
 * posts only. Uploads are stored immediately; the story is saved with **Save post**.
 */
export default function PostStudio({
  ports = defaultPorts,
}: {
  ports?: PostStudioPorts;
}) {
  const portsRef = useRef(ports);
  const {
    posts: postPort,
    photos: photoPort,
    upload: uploadPort,
  } = portsRef.current;
  const { confirm } = useEditingWorkspace();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [library, setLibrary] = useState<Photo[]>([]);
  const [uploaded, setUploaded] = useState<Photo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [original, setOriginal] = useState<EditorDraft>(() =>
    editorDraftOf(null),
  );
  const [draft, setDraft] = useState<EditorDraft>(original);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [photoSlot, setPhotoSlot] = useState<HTMLDivElement | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PostState | "all">("all");
  const [uploading, setUploading] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(false);
  const locked = busy || uploading;
  const shownPosts = (posts ?? []).filter(
    (post) =>
      (filter === "all" || stateOf(post) === filter) &&
      `${post.title} ${post.tags.join(" ")}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const editing = selectedId !== null;
  const selected = posts?.find((post) => post.id === selectedId) ?? null;
  const dirty = editing && !sameDraft(draft, original);

  const load = async () => {
    setLoadError("");
    try {
      setPosts(await postPort.all());
    } catch (caught) {
      setLoadError(
        caught instanceof Error ? caught.message : "Posts could not be loaded.",
      );
    }
  };
  useEffect(() => {
    let live = true;
    postPort
      .all()
      .then((value) => live && setPosts(value))
      .catch(
        (caught: unknown) =>
          live &&
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Posts could not be loaded.",
          ),
      );
    photoPort
      .execute()
      .then((value) => live && setLibrary(value ?? []))
      .catch(() => {
        /* The library is optional: uploads and saved posts still work. */
      });
    return () => {
      live = false;
    };
  }, [postPort, photoPort]);

  // Every photo the editor knows: the library, what saved posts show and new uploads.
  const photos = useMemo(() => {
    const known = new Map<string, Photo>();
    for (const post of posts ?? [])
      for (const block of post.blocks)
        if (block.kind === "PHOTO") known.set(block.photo.getId(), block.photo);
    for (const photo of [...library, ...uploaded])
      known.set(photo.getId(), photo);
    return known;
  }, [posts, library, uploaded]);

  const open = (post: Post | null, id: string | null) => {
    const next = editorDraftOf(post);
    setSelectedId(id);
    setOriginal(next);
    setDraft(next);
    setError("");
    setNotice("");
    setConflict(false);
    setPreviewing(false);
  };
  const choose = async (post: Post | null) => {
    if (locked) return;
    const id = post ? post.id : "new";
    if (id === selectedId) return;
    if (
      (dirty || pendingUploads) &&
      !(await confirm(
        "Discard changes?",
        "This post has unsaved changes. Leave it and lose them?",
      ))
    )
      return;
    open(post, id);
  };

  const save = async (): Promise<boolean> => {
    if (locked) return false;
    if (pendingUploads) {
      setError("Upload or remove the selected photos before saving the post.");
      return false;
    }
    const body = postDraftOf(draft);
    const problem =
      body.status === "PUBLISHED" ? publishingProblem(body) : null;
    if (problem) {
      setError(problem);
      return false;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved =
        selected === null
          ? await postPort.create(body)
          : await postPort.update(selected.id, body, selected.version);
      setPosts((previous) => [
        saved,
        ...(previous ?? []).filter((post) => post.id !== saved.id),
      ]);
      open(saved, saved.id);
      setNotice(
        saved.status === "DRAFT"
          ? "Draft saved."
          : isScheduled(saved)
            ? "Post scheduled."
            : "Post published.",
      );
      return true;
    } catch (caught) {
      setConflict(caught instanceof PostConflictError);
      setError(
        caught instanceof RateLimitError
          ? rateLimitMessage(caught)
          : caught instanceof Error
            ? caught.message
            : "The post could not be saved.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  useUnsavedEditor(dirty, {
    label: draft.title.trim() ? `Post “${draft.title.trim()}”` : "Post",
    save,
    discard: () => setDraft(original),
    document: {
      original,
      draft,
      restore: (value) => {
        if (!locked) setDraft(value as EditorDraft);
      },
      undoScope: original,
    },
  });

  const remove = async () => {
    if (!selected) {
      open(null, null);
      return;
    }
    if (
      !(await confirm(
        "Delete this post?",
        "Its likes and saves go with it. Its photos stay in Photos, posts-only ones included.",
      ))
    )
      return;
    setBusy(true);
    setError("");
    try {
      await postPort.remove(selected.id);
      setPosts((previous) =>
        (previous ?? []).filter((post) => post.id !== selected.id),
      );
      open(null, null);
      setNotice("Post deleted.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The post could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  };

  const reloadPost = async () => {
    await load();
    setConflict(false);
    setError(
      "Reloaded. Open the post again to see its saved state; your edits are still here.",
    );
  };

  const change = (patch: Partial<EditorDraft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));
  const setBlocks = (update: (blocks: EditorBlock[]) => EditorBlock[]) =>
    setDraft((previous) => ({ ...previous, blocks: update(previous.blocks) }));
  const addPhoto = (photo: Photo) =>
    setBlocks((blocks) =>
      blocks.length >= MAX_POST_BLOCKS
        ? blocks
        : [
            ...blocks,
            {
              key: newKey(),
              kind: "PHOTO",
              photoId: photo.getId(),
              caption: "",
            },
          ],
    );

  const previewPost: Post | null = editing
    ? {
        id: selected?.id ?? "preview",
        version: selected?.version ?? 1,
        title: draft.title,
        status: draft.status,
        publishedAt: postDraftOf(draft).publishedAt
          ? new Date(postDraftOf(draft).publishedAt as string)
          : draft.status === "PUBLISHED"
            ? new Date()
            : null,
        tags: draft.tags,
        likes: selected?.likes ?? 0,
        liked: false,
        saved: false,
        blocks: draft.blocks.flatMap((block): PostBlock[] => {
          if (block.kind === "TEXT")
            return [
              { kind: "TEXT" as const, text: block.text, style: block.style },
            ];
          const photo = photos.get(block.photoId);
          return photo
            ? [
                {
                  kind: "PHOTO" as const,
                  caption: block.caption.trim() || null,
                  photo,
                  hasDetail:
                    photo.getClassification().visibility !== "POSTS_ONLY",
                },
              ]
            : [];
        }),
      }
    : null;

  return (
    <main className="upload-workspace">
      <div className="upload-container post-studio">
        <div className="upload-heading">
          <h1>Posts</h1>
          <p>
            Home&rsquo;s journal: text and photos in the order you choose, with
            tags and a publication date. Drafts and scheduled posts are seen
            only here.
          </p>
        </div>
        {loadError && (
          <p role="alert">
            {loadError}{" "}
            <button type="button" onClick={load}>
              Retry
            </button>
          </p>
        )}
        <div className="post-studio__layout">
          <aside className="post-studio__list" aria-label="Posts">
            <div className="post-studio__library-heading">
              <span>Your journal</span>
              <small>
                {posts?.length ?? "…"} {posts?.length === 1 ? "post" : "posts"}
              </small>
            </div>
            <button
              type="button"
              className="post-studio__new"
              aria-pressed={selectedId === "new"}
              disabled={locked || posts === null}
              onClick={() => choose(null)}
            >
              <PostIcon name="plus" /> New post
            </button>
            <label className="post-studio__search">
              <PostIcon name="search" />
              <input
                type="search"
                aria-label="Search posts"
                placeholder="Find a title or tag…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div
              className="post-studio__filters"
              role="group"
              aria-label="Filter posts"
            >
              {(["all", "draft", "scheduled", "published"] as const).map(
                (state) => (
                  <button
                    key={state}
                    type="button"
                    aria-pressed={filter === state}
                    onClick={() => setFilter(state)}
                  >
                    {state === "all" ? "All" : STATE_LABELS[state]}{" "}
                    <small>
                      {
                        (posts ?? []).filter(
                          (post) => state === "all" || stateOf(post) === state,
                        ).length
                      }
                    </small>
                  </button>
                ),
              )}
            </div>
            {posts === null && !loadError && (
              <p role="status" className="post-studio__hint">
                Loading your journal…
              </p>
            )}
            {posts && posts.length === 0 && (
              <EmptyState picture="comments" title="No posts yet" quiet>
                Start one with New post.
              </EmptyState>
            )}
            {posts !== null && posts.length > 0 && !shownPosts.length && (
              <p className="post-studio__hint">
                No posts match. Try another title, tag or status.
              </p>
            )}
            <ul>
              {shownPosts.map((post) => {
                const cover = post.blocks.find(
                  (block) => block.kind === "PHOTO",
                );
                return (
                  <li key={post.id}>
                    <button
                      type="button"
                      aria-pressed={post.id === selectedId}
                      disabled={locked}
                      onClick={() => choose(post)}
                    >
                      <span
                        className="post-studio__card-cover"
                        aria-hidden="true"
                      >
                        {cover ? (
                          <PhotoImage
                            photo={cover.photo}
                            maxWidth={160}
                            fallbackSizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <PostIcon name="text" />
                        )}
                      </span>
                      <span className="post-studio__card-copy">
                        <strong>{post.title || "Untitled post"}</strong>
                        <span className="post-studio__meta">
                          <span
                            className={`post-studio__state post-studio__state--${stateOf(post)}`}
                          >
                            {STATE_LABELS[stateOf(post)]}
                          </span>
                          {post.publishedAt &&
                            post.publishedAt.toLocaleDateString()}
                        </span>
                        <small className="post-studio__excerpt">
                          {post.blocks.find((block) => block.kind === "TEXT")
                            ?.text || `${post.blocks.length} blocks`}
                        </small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          {editing ? (
            <section className="post-studio__editor" aria-label="Post editor">
              <fieldset className="post-studio__editing" disabled={locked}>
                <legend className="sr-only">Compose post</legend>
                <div className="post-studio__actions">
                  <span className="post-studio__save-state">
                    <PostIcon
                      name={dirty || selected === null ? "edit" : "check"}
                    />
                    {uploading
                      ? "Uploading photos…"
                      : busy
                        ? "Saving…"
                        : dirty
                          ? "Unsaved changes"
                          : selected
                            ? "All changes saved"
                            : "New draft"}
                  </span>
                  <EditorActions
                    onSave={save}
                    busy={busy}
                    dirty={dirty}
                    canSave={!pendingUploads && (dirty || selected === null)}
                    saveLabel="Save post"
                    onCancel={() => setDraft(original)}
                  />
                  <button
                    type="button"
                    aria-pressed={previewing}
                    onClick={() => setPreviewing(!previewing)}
                  >
                    <PostIcon name={previewing ? "edit" : "eye"} />
                    {previewing ? "Edit" : "Preview"}
                  </button>
                  <button
                    type="button"
                    className="post-studio__delete"
                    disabled={busy}
                    onClick={remove}
                  >
                    <PostIcon name="trash" />
                    {selected ? "Delete post" : "Discard"}
                  </button>
                </div>
                {notice && (
                  <p role="status" className="post-studio__notice">
                    {notice}
                  </p>
                )}
                {error && (
                  <p role="alert" className="post-studio__error">
                    {error}{" "}
                    {conflict && (
                      <button type="button" onClick={reloadPost}>
                        Reload posts
                      </button>
                    )}
                  </p>
                )}
                {pendingUploads && (
                  <p className="post-studio__hint">
                    Upload or remove the selected photos before saving the post.
                  </p>
                )}
                {previewing && previewPost && (
                  <div
                    className="post-studio__preview"
                    data-device={previewDevice}
                  >
                    <div className="post-studio__preview-tools">
                      <span>Reader preview</span>
                      <DeviceSwitch
                        label="Preview size"
                        value={previewDevice}
                        onChange={setPreviewDevice}
                      />
                    </div>
                    <DeviceFrame device={previewDevice}>
                      <div className="post-studio__preview-page">
                        <PostArticle
                          post={previewPost}
                          preview
                          linkTitle={false}
                        />
                      </div>
                    </DeviceFrame>
                  </div>
                )}
                <div
                  key={selectedId}
                  className="post-studio__compose"
                  hidden={previewing}
                >
                  <div className="post-studio__paper">
                    <div className="post-studio__section-heading">
                      <PostIcon name="edit" />
                      <div>
                        <h2>Your story</h2>
                        <p>
                          Give it a title, then bring it to life with text and
                          photographs.
                        </p>
                      </div>
                    </div>
                    <label className="post-studio__field post-studio__title">
                      <span>Title</span>
                      <input
                        value={draft.title}
                        maxLength={200}
                        onChange={(event) =>
                          change({ title: event.target.value })
                        }
                        placeholder="A title for the post"
                      />
                    </label>
                    <div className="post-studio__body-heading">
                      <h3>Story blocks</h3>
                      <small>
                        {draft.blocks.length} / {MAX_POST_BLOCKS}
                      </small>
                    </div>
                    <BlockList
                      blocks={draft.blocks}
                      photos={photos}
                      onChange={setBlocks}
                    />
                    <AddBlocks
                      key={selectedId}
                      remaining={MAX_POST_BLOCKS - draft.blocks.length}
                      library={library.filter(
                        (photo) =>
                          POSTABLE.includes(
                            photo.getClassification().visibility,
                          ) &&
                          !draft.blocks.some(
                            (block) =>
                              block.kind === "PHOTO" &&
                              block.photoId === photo.getId(),
                          ),
                      )}
                      onText={() =>
                        setBlocks((blocks) =>
                          blocks.length >= MAX_POST_BLOCKS
                            ? blocks
                            : [
                                ...blocks,
                                {
                                  key: newKey(),
                                  kind: "TEXT",
                                  text: "",
                                  style: "BODY",
                                },
                              ],
                        )
                      }
                      onPhoto={addPhoto}
                      previewSlot={photoSlot}
                      upload={uploadPort}
                      onUploadingChange={setUploading}
                      onPendingChange={setPendingUploads}
                      onUploaded={(photo) => {
                        setUploaded((previous) => [...previous, photo]);
                        addPhoto(photo);
                      }}
                    />
                  </div>
                  <aside
                    className="post-studio__publishing"
                    aria-label="Publishing settings"
                  >
                    <div className="post-studio__section-heading">
                      <PostIcon name="calendar" />
                      <div>
                        <h2>Publishing</h2>
                        <p>You decide when your story goes live.</p>
                      </div>
                    </div>
                    <div className="post-studio__row">
                      <fieldset className="post-studio__status">
                        <legend>Status</legend>
                        {(["DRAFT", "PUBLISHED"] as const).map((status) => (
                          <label key={status}>
                            <input
                              type="radio"
                              name="post-status"
                              value={status}
                              aria-label={
                                status === "DRAFT" ? "Draft" : "Published"
                              }
                              checked={draft.status === status}
                              onChange={() => change({ status })}
                            />
                            <span>
                              <strong>
                                {status === "DRAFT" ? "Draft" : "Published"}
                              </strong>
                              <small>
                                {status === "DRAFT"
                                  ? "Only you can see it"
                                  : "Visible on Home when due"}
                              </small>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <PostDatePicker
                        value={draft.publishedAt}
                        onChange={(publishedAt) => change({ publishedAt })}
                      />
                    </div>
                    <TagField
                      tags={draft.tags}
                      onChange={(tags) => change({ tags })}
                    />
                    <p className="post-studio__publishing-summary">
                      {draft.status === "DRAFT"
                        ? "Save as a draft to keep working at your own pace."
                        : draft.publishedAt &&
                            new Date(draft.publishedAt) > new Date()
                          ? `Saving schedules this post for ${new Date(draft.publishedAt).toLocaleString()}.`
                          : "Saving makes this post visible on Home immediately."}
                    </p>
                    {/* The photograph being prepared shows here on wide screens. */}
                    <div ref={setPhotoSlot} className="post-studio__photo-slot" />
                  </aside>
                </div>
              </fieldset>
            </section>
          ) : (
            <section className="post-studio__editor post-studio__editor--empty">
              <EmptyState picture="comments" title="Choose a post">
                Pick one from the list or start a new post.
              </EmptyState>
              {notice && (
                <p role="status" className="post-studio__notice">
                  {notice}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

type PostState = "draft" | "scheduled" | "published";
const STATE_LABELS: Record<PostState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};
const stateOf = (post: Post): PostState =>
  post.status === "DRAFT"
    ? "draft"
    : isScheduled(post)
      ? "scheduled"
      : "published";

function TagField({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const add = (raw: string) => {
    const next = [...tags];
    for (const part of raw.split(",")) {
      if (!part.trim()) continue;
      const tag = normalizeTag(part);
      if (!tag) {
        setProblem(
          `“${part.trim()}” is not a tag: use letters, numbers, spaces, - or _.`,
        );
        return;
      }
      if (!next.includes(tag)) next.push(tag);
    }
    if (next.length > MAX_POST_TAGS) {
      setProblem(`A post takes up to ${MAX_POST_TAGS} tags.`);
      return;
    }
    setProblem("");
    setText("");
    onChange(next);
  };
  return (
    <div className="post-studio__field">
      <label htmlFor="post-tags">Tags</label>
      <div className="post-studio__tags">
        {tags.map((tag) => (
          <span key={tag} className="post-studio__tag">
            #{tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(tags.filter((each) => each !== tag))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="post-tags"
          value={text}
          placeholder={tags.length ? "Another tag" : "travel, black and white…"}
          onChange={(event) => {
            const value = event.target.value;
            if (value.includes(",")) add(value);
            else setText(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(text);
            } else if (event.key === "Backspace" && !text && tags.length)
              onChange(tags.slice(0, -1));
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
      <small>
        Enter or a comma closes a tag. Visitors can open every post with it.
      </small>
      {problem && (
        <p role="alert" className="post-studio__error">
          {problem}
        </p>
      )}
    </div>
  );
}

function BlockList({
  blocks,
  photos,
  onChange,
}: {
  blocks: EditorBlock[];
  photos: Map<string, Photo>;
  onChange: (update: (blocks: EditorBlock[]) => EditorBlock[]) => void;
}) {
  const move = (from: number, to: number) =>
    onChange((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const { order, dragging, attachList, attachItem, itemStyle, gripProps } =
    useLiveSort({
      keys: blocks.map((block) => block.key),
      onMove: move,
    });
  const update = (key: string, patch: Partial<EditorBlock>) =>
    onChange((current) =>
      current.map((block) =>
        block.key === key ? ({ ...block, ...patch } as EditorBlock) : block,
      ),
    );
  if (!blocks.length)
    return <p className="post-studio__hint">Add text or photos to begin.</p>;
  return (
    <ol
      ref={attachList}
      className={`post-studio__blocks${dragging ? " is-sorting" : ""}`}
      aria-label="Post blocks"
    >
      {order.map((key) => {
        const index = blocks.findIndex((block) => block.key === key);
        const block = blocks[index];
        if (!block) return null;
        const photo =
          block.kind === "PHOTO" ? photos.get(block.photoId) : undefined;
        const name =
          block.kind === "TEXT"
            ? `${STYLE_LABELS[block.style]} block`
            : (photo?.getTitle() ?? "Photo");
        return (
          <li
            key={key}
            ref={attachItem(key)}
            style={itemStyle(key)}
            className={`post-studio__block${dragging === key ? " is-dragged" : ""}`}
          >
            <div className="post-studio__block-tools">
              <button
                type="button"
                className="post-studio__grip"
                aria-label={`Move ${name}, position ${index + 1} of ${blocks.length}`}
                title="Drag or use the arrow keys to reorder"
                {...gripProps(key)}
              >
                <PostIcon name="grip" />
              </button>
              <button
                type="button"
                aria-label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <PostIcon name="up" />
              </button>
              <button
                type="button"
                aria-label={`Move ${name} down`}
                disabled={index === blocks.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <PostIcon name="down" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() =>
                  onChange((current) =>
                    current.filter((each) => each.key !== key),
                  )
                }
              >
                <PostIcon name="trash" />
              </button>
              <span className="post-studio__block-label">
                {String(index + 1).padStart(2, "0")} ·{" "}
                {block.kind === "TEXT" ? STYLE_LABELS[block.style] : "Photo"}
              </span>
            </div>
            {block.kind === "TEXT" ? (
              <div className="post-studio__text">
                <TextStyleChoice
                  value={block.style}
                  label={`Style of block ${index + 1}`}
                  onChange={(style) => update(key, { style })}
                />
                <label>
                  <span className="sr-only">Text of block {index + 1}</span>
                  <textarea
                    value={block.text}
                    maxLength={10000}
                    rows={block.style === "HEADING" ? 1 : 4}
                    placeholder={
                      block.style === "HEADING"
                        ? "A heading"
                        : "Write here. A blank line starts a new paragraph."
                    }
                    onChange={(event) =>
                      update(key, { text: event.target.value })
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="post-studio__photo">
                <span className="post-studio__thumb">
                  {photo ? (
                    <PhotoImage
                      photo={photo}
                      className="object-cover"
                      maxWidth={320}
                      fallbackSizes="120px"
                    />
                  ) : (
                    <span aria-hidden="true">?</span>
                  )}
                </span>
                <div>
                  <strong>{photo?.getTitle() ?? "Photo not available"}</strong>
                  <VisibilityNote
                    visibility={photo?.getClassification().visibility}
                  />
                  <label>
                    <span className="sr-only">Caption of {name}</span>
                    <input
                      value={block.caption}
                      maxLength={500}
                      placeholder="Caption (optional)"
                      onChange={(event) =>
                        update(key, { caption: event.target.value })
                      }
                    />
                  </label>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function VisibilityNote({ visibility }: { visibility?: PhotoVisibility }) {
  if (visibility === "POSTS_ONLY")
    return (
      <small className="post-studio__note">
        Posts only · opens no detail view
      </small>
    );
  if (visibility === "PRIVATE" || visibility === "SELECT")
    return (
      <small className="post-studio__note post-studio__note--warn">
        Private · it keeps the post from being published
      </small>
    );
  if (visibility === "COLLECTIONS_ONLY")
    return (
      <small className="post-studio__note">
        Collections only · opens its detail view
      </small>
    );
  return (
    <small className="post-studio__note">
      In the gallery · opens its detail view with comments
    </small>
  );
}

function AddBlocks({
  remaining,
  library,
  onText,
  onPhoto,
  upload,
  onUploaded,
  onUploadingChange,
  onPendingChange,
  previewSlot,
}: {
  previewSlot?: HTMLElement | null;
  remaining: number;
  library: Photo[];
  onText: () => void;
  onPhoto: (photo: Photo) => void;
  upload: PostStudioPorts["upload"];
  onUploaded: (photo: Photo) => void;
  onUploadingChange: (value: boolean) => void;
  onPendingChange: (value: boolean) => void;
}) {
  const full = remaining <= 0;
  const [picking, setPicking] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  // The card being worked on lends its photograph to the publishing column.
  const [active, setActive] = useState<number | null>(null);
  const waiting = items.filter((item) => item.status !== "published");
  const shown = waiting.some((item) => item.id === active)
    ? active
    : (waiting[0]?.id ?? null);
  const urls = useRef(new Set<string>());
  const nextId = useRef(0);
  const [uploading, setUploading] = useState("");
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { catalog } = useClassificationCatalog();
  const pending = items.some((item) => item.status !== "published");
  const reserved = items.filter((item) => item.status !== "published").length;
  const noSpace = remaining <= reserved;
  useUnsavedEditor(pending, {
    label: "Post photo uploads",
    save: async () => ({
      error: "Upload or remove the selected photos in the post editor first",
    }),
    discard: () =>
      setItems((previous) =>
        previous.filter((item) => item.status === "published"),
      ),
  });
  useEffect(() => {
    onPendingChange(pending);
    return () => onPendingChange(false);
  }, [pending, onPendingChange]);
  useEffect(() => {
    const allocated = urls.current;
    return () => allocated.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const patch = (id: number, fields: Partial<UploadItem>) =>
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...fields } : item)),
    );
  const addFiles = (files: File[]) => {
    const available = Math.max(
      0,
      remaining - items.filter((item) => item.status !== "published").length,
    );
    const additions: UploadItem[] = [];
    const errors: string[] = [];
    for (const file of files.slice(0, available)) {
      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/avif",
          "image/gif",
        ].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      ) {
        errors.push(
          `${file.name}: choose a JPEG, PNG, WebP, AVIF or GIF up to 10 MB.`,
        );
        continue;
      }
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      additions.push({
        id: nextId.current++,
        file,
        preview,
        title: fileTitle(file),
        description: "",
        highlights: {},
        frame: null,
        trim: null,
        status: "draft",
        classification: { ...publicClassification(), visibility: "POSTS_ONLY" },
      });
    }
    if (files.length > available)
      errors.push(
        `Only ${available} more ${available === 1 ? "photo fits" : "photos fit"} in this post. Extra files were not uploaded.`,
      );
    setProblem(errors.join(" "));
    setItems((previous) => [...previous, ...additions]);
  };

  const send = async (onlyId?: number) => {
    if (full || uploading) return;
    const batch = items
      .filter(
        (item) =>
          item.status !== "published" &&
          (onlyId === undefined || item.id === onlyId),
      )
      .slice(0, remaining);
    if (!batch.length) return;
    if (batch.some((item) => !item.title.trim())) {
      setProblem("Give every photo a title before uploading.");
      return;
    }
    setProblem("");
    onUploadingChange(true);
    for (const item of batch) {
      setUploading(`Uploading ${item.file.name}…`);
      patch(item.id, { status: "uploading", error: undefined });
      try {
        const published = await upload.execute({
          file: item.file,
          title: item.title.trim(),
          description: item.description.trim() || undefined,
          highlights: item.highlights,
          frame: item.frame,
          ...(item.trim ? { trim: item.trim } : {}),
          ...item.classification,
        });
        patch(item.id, { status: "published", published });
        onUploaded(published.photo);
        window.dispatchEvent(new Event("curator:catalog-changed"));
      } catch (caught) {
        const error = `${item.file.name}: ${apiFailureMessage(caught)}`;
        patch(item.id, { status: "failed", error });
        break;
      }
    }
    setUploading("");
    onUploadingChange(false);
  };

  return (
    <div className="post-studio__add">
      <div className="post-studio__add-row">
        <button type="button" disabled={noSpace} onClick={onText}>
          <PostIcon name="text" />
          <span>Text</span>
        </button>
        <button
          type="button"
          disabled={noSpace}
          aria-expanded={picking}
          onClick={() => setPicking(!picking)}
        >
          <PostIcon name="photo" />
          <span>Photo from the library</span>
        </button>
        <button
          type="button"
          disabled={noSpace || Boolean(uploading)}
          onClick={() => input.current?.click()}
        >
          <PostIcon name="upload" />
          <span>Upload photos…</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) addFiles(files);
          }}
        />
      </div>
      {items.length > 0 && (
        <div className="post-studio__uploads">
          <p className="post-studio__hint">
            Prepare your photos, then upload. Photos are stored immediately;
            save the post separately.
          </p>
          {items.map((item, index) => (
            <UploadCard
              key={item.id}
              item={item}
              index={index}
              forPost
              previewSlot={item.id === shown ? previewSlot : undefined}
              onActivate={() => setActive(item.id)}
              running={Boolean(uploading)}
              onChange={(fields) => patch(item.id, fields)}
              onRemove={() => {
                URL.revokeObjectURL(item.preview);
                urls.current.delete(item.preview);
                setItems((previous) =>
                  previous.filter((each) => each.id !== item.id),
                );
              }}
              onUpload={() => void send(item.id)}
            />
          ))}
          {items.filter((item) => item.status !== "published").length > 1 && (
            <button
              type="button"
              disabled={Boolean(uploading) || full}
              onClick={() => void send()}
            >
              Upload all photos
            </button>
          )}
        </div>
      )}
      {uploading && <p role="status">{uploading}</p>}
      {problem && (
        <p role="alert" className="post-studio__error">
          {problem}
        </p>
      )}
      {full && (
        <p className="post-studio__hint">
          A post takes up to {MAX_POST_BLOCKS} blocks.
        </p>
      )}
      {picking &&
        !noSpace &&
        (catalog ? (
          <PhotoPicker photos={library} catalog={catalog} onPick={onPhoto} />
        ) : (
          <p className="upload-muted">Loading the library…</p>
        ))}
    </div>
  );
}
