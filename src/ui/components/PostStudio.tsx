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
import { getManagedPhotos, uploadPhoto } from "@/src/infrastructure/photoServices";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { rateLimitMessage } from "@/src/ui/rateLimitMessage";
import { useLiveSort } from "@/src/ui/hooks/useLiveSort";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { useClassificationCatalog } from "./ClassificationCatalog";
import { ChoiceMenu } from "./ChoiceMenu";
import { EmptyState } from "./EmptyState";
import { PhotoImage } from "./PhotoImage";
import { PhotoPicker } from "./PhotoPicker";
import { PostArticle } from "./PostArticle";
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

const STYLE_LABELS: Record<PostTextStyle, string> = {
  BODY: "Text",
  HEADING: "Heading",
  QUOTE: "Quote",
};

// Photos that a published post can show. Private and select ones never can; a
// collections-only one can while it is in a collection, which the API checks.
const POSTABLE: PhotoVisibility[] = ["PUBLIC", "COLLECTIONS_ONLY", "POSTS_ONLY"];

let nextKey = 0;
const newKey = () => `block-${++nextKey}`;

const pad = (value: number) => String(value).padStart(2, "0");
export function toLocalInput(date: Date | null): string {
  if (!date) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function editorDraftOf(post: Post | null): EditorDraft {
  if (!post)
    return { title: "", status: "DRAFT", publishedAt: "", tags: [], blocks: [] };
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
    publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    tags: draft.tags,
    blocks: draft.blocks.map((block) =>
      block.kind === "TEXT"
        ? { kind: "TEXT", text: block.text, style: block.style }
        : { kind: "PHOTO", photoId: block.photoId, caption: block.caption.trim() },
    ),
  };
}

const sameDraft = (a: EditorDraft, b: EditorDraft) =>
  JSON.stringify(postDraftOf(a)) === JSON.stringify(postDraftOf(b));

const fileTitle = (file: File) =>
  file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled";

/**
 * Curator → Posts: Home's journal. A list of every post (drafts and scheduled ones
 * marked) beside the editor: title, status and publication date, tags, and the body as
 * blocks of text and photos that reorder by dragging their grip or with the arrows.
 * Photos come from the library or are uploaded here, to the gallery as well or for
 * posts only. Nothing is written until **Save post**.
 */
export default function PostStudio({ ports = defaultPorts }: { ports?: PostStudioPorts }) {
  const portsRef = useRef(ports);
  const { posts: postPort, photos: photoPort, upload: uploadPort } = portsRef.current;
  const { confirm } = useEditingWorkspace();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [library, setLibrary] = useState<Photo[]>([]);
  const [uploaded, setUploaded] = useState<Photo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [original, setOriginal] = useState<EditorDraft>(() => editorDraftOf(null));
  const [draft, setDraft] = useState<EditorDraft>(original);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const editing = selectedId !== null;
  const selected = posts?.find((post) => post.id === selectedId) ?? null;
  const dirty = editing && !sameDraft(draft, original);

  const load = async () => {
    setLoadError("");
    try {
      setPosts(await postPort.all());
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Posts could not be loaded.");
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
          setLoadError(caught instanceof Error ? caught.message : "Posts could not be loaded."),
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
    for (const photo of [...library, ...uploaded]) known.set(photo.getId(), photo);
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
    const id = post ? post.id : "new";
    if (id === selectedId) return;
    if (
      dirty &&
      !(await confirm("Discard changes?", "This post has unsaved changes. Leave it and lose them?"))
    )
      return;
    open(post, id);
  };

  const save = async (): Promise<boolean> => {
    const body = postDraftOf(draft);
    const problem = body.status === "PUBLISHED" ? publishingProblem(body) : null;
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
      setPosts((previous) => [saved, ...(previous ?? []).filter((post) => post.id !== saved.id)]);
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
      setPosts((previous) => (previous ?? []).filter((post) => post.id !== selected.id));
      open(null, null);
      setNotice("Post deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The post could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const reloadPost = async () => {
    await load();
    setConflict(false);
    setError("Reloaded. Open the post again to see its saved state; your edits are still here.");
  };

  const change = (patch: Partial<EditorDraft>) => setDraft((previous) => ({ ...previous, ...patch }));
  const setBlocks = (update: (blocks: EditorBlock[]) => EditorBlock[]) =>
    setDraft((previous) => ({ ...previous, blocks: update(previous.blocks) }));
  const addPhoto = (photo: Photo) =>
    setBlocks((blocks) =>
      blocks.length >= MAX_POST_BLOCKS
        ? blocks
        : [...blocks, { key: newKey(), kind: "PHOTO", photoId: photo.getId(), caption: "" }],
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
          if (block.kind === "TEXT") return [{ kind: "TEXT" as const, text: block.text, style: block.style }];
          const photo = photos.get(block.photoId);
          return photo
            ? [
                {
                  kind: "PHOTO" as const,
                  caption: block.caption.trim() || null,
                  photo,
                  hasDetail: photo.getClassification().visibility !== "POSTS_ONLY",
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
            Home&rsquo;s journal: text and photos in the order you choose, with tags and a
            publication date. Drafts and scheduled posts are seen only here.
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
            <button
              type="button"
              className="post-studio__new"
              aria-pressed={selectedId === "new"}
              onClick={() => choose(null)}
            >
              + New post
            </button>
            {posts && posts.length === 0 && (
              <EmptyState picture="comments" title="No posts yet" quiet>
                Start one with New post.
              </EmptyState>
            )}
            <ul>
              {(posts ?? []).map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    aria-pressed={post.id === selectedId}
                    onClick={() => choose(post)}
                  >
                    <strong>{post.title || "Untitled post"}</strong>
                    <span className="post-studio__meta">
                      <span className={`post-studio__state post-studio__state--${stateOf(post)}`}>
                        {STATE_LABELS[stateOf(post)]}
                      </span>
                      {post.publishedAt && post.publishedAt.toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          {editing ? (
            <section className="post-studio__editor" aria-label="Post editor">
              <div className="post-studio__actions">
                <button type="button" className="post-studio__save" disabled={busy || (!dirty && selected !== null)} onClick={save}>
                  {busy ? "Saving…" : "Save post"}
                </button>
                <button type="button" disabled={!dirty || busy} onClick={() => setDraft(original)}>
                  Cancel changes
                </button>
                <button type="button" aria-pressed={previewing} onClick={() => setPreviewing(!previewing)}>
                  {previewing ? "Edit" : "Preview"}
                </button>
                <button type="button" className="post-studio__delete" disabled={busy} onClick={remove}>
                  {selected ? "Delete post" : "Discard"}
                </button>
              </div>
              {notice && <p role="status" className="post-studio__notice">{notice}</p>}
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
              {previewing && previewPost ? (
                <div className="post-studio__preview">
                  <PostArticle post={previewPost} preview linkTitle={false} />
                </div>
              ) : (
                <>
                  <label className="post-studio__field">
                    <span>Title</span>
                    <input
                      value={draft.title}
                      maxLength={200}
                      onChange={(event) => change({ title: event.target.value })}
                      placeholder="A title for the post"
                    />
                  </label>
                  <div className="post-studio__row">
                    <fieldset className="post-studio__status">
                      <legend>Status</legend>
                      {(["DRAFT", "PUBLISHED"] as const).map((status) => (
                        <label key={status}>
                          <input
                            type="radio"
                            name="post-status"
                            value={status}
                            checked={draft.status === status}
                            onChange={() => change({ status })}
                          />
                          {status === "DRAFT" ? "Draft" : "Published"}
                        </label>
                      ))}
                    </fieldset>
                    <label className="post-studio__field">
                      <span>Publication date</span>
                      <input
                        type="datetime-local"
                        value={draft.publishedAt}
                        onChange={(event) => change({ publishedAt: event.target.value })}
                      />
                      <small>Empty: the moment it is published. A later date schedules it.</small>
                    </label>
                  </div>
                  <TagField tags={draft.tags} onChange={(tags) => change({ tags })} />
                  <BlockList
                    blocks={draft.blocks}
                    photos={photos}
                    onChange={setBlocks}
                  />
                  <AddBlocks
                    full={draft.blocks.length >= MAX_POST_BLOCKS}
                    library={library.filter(
                      (photo) =>
                        POSTABLE.includes(photo.getClassification().visibility) &&
                        !draft.blocks.some(
                          (block) => block.kind === "PHOTO" && block.photoId === photo.getId(),
                        ),
                    )}
                    onText={() =>
                      setBlocks((blocks) => [
                        ...blocks,
                        { key: newKey(), kind: "TEXT", text: "", style: "BODY" },
                      ])
                    }
                    onPhoto={addPhoto}
                    upload={uploadPort}
                    onUploaded={(photo) => {
                      setUploaded((previous) => [...previous, photo]);
                      addPhoto(photo);
                    }}
                  />
                </>
              )}
            </section>
          ) : (
            <section className="post-studio__editor post-studio__editor--empty">
              <EmptyState picture="comments" title="Choose a post">
                Pick one from the list or start a new post.
              </EmptyState>
              {notice && <p role="status" className="post-studio__notice">{notice}</p>}
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
  post.status === "DRAFT" ? "draft" : isScheduled(post) ? "scheduled" : "published";

function TagField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const add = (raw: string) => {
    const next = [...tags];
    for (const part of raw.split(",")) {
      if (!part.trim()) continue;
      const tag = normalizeTag(part);
      if (!tag) {
        setProblem(`“${part.trim()}” is not a tag: use letters, numbers, spaces, - or _.`);
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
      <small>Enter or a comma closes a tag. Visitors can open every post with it.</small>
      {problem && <p role="alert" className="post-studio__error">{problem}</p>}
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
  const { order, dragging, attachList, attachItem, itemStyle, gripProps } = useLiveSort({
    keys: blocks.map((block) => block.key),
    onMove: move,
  });
  const update = (key: string, patch: Partial<EditorBlock>) =>
    onChange((current) =>
      current.map((block) => (block.key === key ? ({ ...block, ...patch } as EditorBlock) : block)),
    );
  if (!blocks.length)
    return (
      <p className="post-studio__hint">
        The post is empty. Add text or photos below; drag the ⠿ grip or use the arrows to
        change their order.
      </p>
    );
  return (
    <ol ref={attachList} className={`post-studio__blocks${dragging ? " is-sorting" : ""}`} aria-label="Post blocks">
      {order.map((key) => {
        const index = blocks.findIndex((block) => block.key === key);
        const block = blocks[index];
        if (!block) return null;
        const photo = block.kind === "PHOTO" ? photos.get(block.photoId) : undefined;
        const name = block.kind === "TEXT" ? `${STYLE_LABELS[block.style]} block` : (photo?.getTitle() ?? "Photo");
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
                ⠿
              </button>
              <button type="button" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${name} down`}
                disabled={index === blocks.length - 1}
                onClick={() => move(index, index + 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onChange((current) => current.filter((each) => each.key !== key))}
              >
                ×
              </button>
            </div>
            {block.kind === "TEXT" ? (
              <div className="post-studio__text">
                <ChoiceMenu
                  value={block.style}
                  ariaLabel={`Style of block ${index + 1}`}
                  options={(Object.keys(STYLE_LABELS) as PostTextStyle[]).map((style) => ({
                    value: style,
                    label: STYLE_LABELS[style],
                  }))}
                  onChange={(style) => update(key, { style })}
                />
                <label>
                  <span className="sr-only">Text of block {index + 1}</span>
                  <textarea
                    value={block.text}
                    maxLength={10000}
                    rows={block.style === "HEADING" ? 1 : 4}
                    placeholder={block.style === "HEADING" ? "A heading" : "Write here. A blank line starts a new paragraph."}
                    onChange={(event) => update(key, { text: event.target.value })}
                  />
                </label>
              </div>
            ) : (
              <div className="post-studio__photo">
                <span className="post-studio__thumb">
                  {photo ? (
                    <PhotoImage photo={photo} className="object-cover" maxWidth={320} fallbackSizes="120px" />
                  ) : (
                    <span aria-hidden="true">?</span>
                  )}
                </span>
                <div>
                  <strong>{photo?.getTitle() ?? "Photo not available"}</strong>
                  <VisibilityNote visibility={photo?.getClassification().visibility} />
                  <label>
                    <span className="sr-only">Caption of {name}</span>
                    <input
                      value={block.caption}
                      maxLength={500}
                      placeholder="Caption (optional)"
                      onChange={(event) => update(key, { caption: event.target.value })}
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
    return <small className="post-studio__note">Posts only · opens no detail view</small>;
  if (visibility === "PRIVATE" || visibility === "SELECT")
    return (
      <small className="post-studio__note post-studio__note--warn">
        Private · it keeps the post from being published
      </small>
    );
  if (visibility === "COLLECTIONS_ONLY")
    return <small className="post-studio__note">Collections only · opens its detail view</small>;
  return <small className="post-studio__note">In the gallery · opens its detail view with comments</small>;
}

function AddBlocks({
  full,
  library,
  onText,
  onPhoto,
  upload,
  onUploaded,
}: {
  full: boolean;
  library: Photo[];
  onText: () => void;
  onPhoto: (photo: Photo) => void;
  upload: PostStudioPorts["upload"];
  onUploaded: (photo: Photo) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [destination, setDestination] = useState<"POSTS_ONLY" | "PUBLIC">("POSTS_ONLY");
  const [uploading, setUploading] = useState("");
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { catalog } = useClassificationCatalog();

  const send = async (files: File[]) => {
    setProblem("");
    for (const file of files) {
      setUploading(`Uploading ${file.name}…`);
      try {
        const { photo } = await upload.execute({
          file,
          title: fileTitle(file),
          visibility: destination,
        });
        onUploaded(photo);
      } catch (caught) {
        setProblem(`${file.name}: ${apiFailureMessage(caught)}`);
        break;
      }
    }
    setUploading("");
  };

  return (
    <div className="post-studio__add">
      <div className="post-studio__add-row">
        <button type="button" disabled={full} onClick={onText}>
          + Text
        </button>
        <button type="button" disabled={full} aria-expanded={picking} onClick={() => setPicking(!picking)}>
          + Photo from the library
        </button>
        <button type="button" disabled={full || Boolean(uploading)} onClick={() => input.current?.click()}>
          Upload photos…
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
            if (files.length) void send(files);
          }}
        />
      </div>
      <fieldset className="post-studio__destination">
        <legend>Uploaded photos go</legend>
        <label>
          <input
            type="radio"
            name="post-upload-destination"
            checked={destination === "POSTS_ONLY"}
            onChange={() => setDestination("POSTS_ONLY")}
          />
          Only in posts <small>(no gallery, no detail view)</small>
        </label>
        <label>
          <input
            type="radio"
            name="post-upload-destination"
            checked={destination === "PUBLIC"}
            onChange={() => setDestination("PUBLIC")}
          />
          To the gallery too <small>(detail view with comments)</small>
        </label>
      </fieldset>
      {uploading && <p role="status">{uploading}</p>}
      {problem && <p role="alert" className="post-studio__error">{problem}</p>}
      {full && <p className="post-studio__hint">A post takes up to {MAX_POST_BLOCKS} blocks.</p>}
      {picking &&
        (catalog ? (
          <PhotoPicker photos={library} catalog={catalog} onPick={onPhoto} />
        ) : (
          <p className="upload-muted">Loading the library…</p>
        ))}
    </div>
  );
}
