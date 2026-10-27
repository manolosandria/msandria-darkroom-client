@AGENTS.md

# msandria-darkroom-client

The public web of **msandria-darkroom**, a photography gallery. It is one of two
repositories: this Next.js site, and `msandria-darkroom-api`, a private NestJS API that
owns the database and the image host. The browser never talks to the image host or to
any third-party service directly — image URLs arrive ready-made from the API.

**This repository is public. Everything in it is written in English:** code, comments,
test descriptions and the `.feature` files. The API repository uses Spanish; do not
carry that convention over here, and do not mix the two inside a file.

## Running it

| Step | Command |
|---|---|
| Install | `npm ci` |
| Configure | copy `.env.example` to `.env.local` and fill it in |
| Develop | `npm run dev` (port 3000) |
| Develop, cache cleared | `npm run dev:clean`: deletes `.next/dev` first. Use it when the dev server keeps serving an old stylesheet |

Node version is pinned in `.nvmrc`. `nvm-windows` does not read that file, so on Windows
the version has to be named by hand: `nvm use 24.22.1`.

`.env.local` is ignored by git and must never be committed. Two variables, both
inlined into the client bundle at build time, so both must be set **before** a
production build:

- `NEXT_PUBLIC_API_URL` — base URL of the API, no trailing slash. The API must list this
  site's origin in its own CORS configuration.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — the OAuth client id, the same value the API verifies
  tokens against. Not a secret: it only says which application a token was issued for.

There is no client secret and no redirect URI in this project, and none belongs in this
repository. See "Sessions" below.

One optional build-time variable, `IMAGE_ORIGINS`, names extra image hosts for the
Content-Security-Policy (https origins, comma-separated), such as the domain in front
of the API's R2 bucket. Cloudinary is always allowed.

## Checks before opening a pull request

```
npm run typecheck
npm run lint
npm test
npm run build
```

CI (`.github/workflows/ci.yml`) runs the same on Linux. Anything that fails only on
Linux shows up in the pull request.

## Layout

| Path | What it holds |
|---|---|
| `app/` | Routes: `/` (home), `/gallery`, `/photo/[id]`, `/curator`, `/upload`, `/manage`, `/moderate`, `/collections`, `/contact`, `/account` |
| `src/domain/` | Entities (`Photo`, `User`, `PhotoComment`, `PublicName`, `Catalog`) and repository interfaces, `ContactRepository` included |
| `src/application/` | Use cases, one class each |
| `src/infrastructure/` | Repository implementations, the HTTP client, service wiring |
| `src/ui/` | Components and hooks |
| `features/` | Gherkin scenarios describing behaviour |

Dependencies point inwards: `domain` knows nothing of the others, `application` depends
only on `domain` interfaces, and `infrastructure` supplies the implementations. A
component reaches the API through a use case, never with its own `fetch`.

`/curator` gathers the administrator's screens as tabs and is what the header offers
the administrator, as **Curator** with a count of pending comments and unread
messages; see "Curator" below. `/upload` publishes through the API's `POST /photos`.
`/manage` edits what is already published, through `PATCH /photos/:id`, and is
reached from a link on `/upload` or the Photos tab rather than from the header.

## Upload and management

`/upload` takes several photos at once, by drop or picker, and gives each one its own
panel: title, description, preview, the file's measurements and, once published, the
API's optimization report. Publishing walks the queue one request at a time, so a
rejected photo keeps its edits and is the only one retried.

`HighlightEditor` edits the optional square, landscape and portrait crops as fractions
of the oriented photo, which is why the numbers still mean the same thing against any
rendition. Nothing is cropped automatically. The same editor serves `/manage`, where
published titles, descriptions and crops are saved through the `SavePhoto` use case and
the repository's `save`. The API's highlights migration has to be applied before either
screen works.

## Sessions

Visitors sign in with Google. Google Identity Services hands the page a signed ID token,
which goes to the API; the session comes back in an `HttpOnly` cookie. There is no
redirect back from Google and no authorization code to exchange, which is why no secret
is needed here.

Three rules worth keeping:

- **The session cookie is `HttpOnly` on purpose.** This code cannot read it, so never try
  to infer the session from `document.cookie`. Ask the API who is signed in.
- **One session for the whole page.** `SessionProvider` wraps the tree in
  `app/layout.tsx` and asks `GET /auth/me` once; `useSessionValue()` is how a component
  reads it. Calling `useSession` again in a component would spend another round trip
  learning the same thing, and the two could disagree while the answers were in flight.
- **Every call to the API carries `credentials: "include"`**, or the browser will not
  attach the cookie across origins.
- **A role decides what the interface offers, never what is allowed.** `User.isAdmin()`
  drives what appears on screen. The API settles permissions on every request by reading
  the role from its own database, so changing anything in the browser changes the view
  and nothing else. Do not add a check here and assume it protects anything.

`src/infrastructure/googleIdentity.ts` is the only place that touches `window.google`,
so everything above it stays testable without loading Google's script.

## Security headers

`security-headers.ts` builds them and `next.config.ts` serves them on every page. The
`Content-Security-Policy` is the one that can break the site: it names the only origins
anything may be loaded from, so **a new third-party script, stylesheet, image host, frame
or API has to be added there or the browser will block it**, with nothing to show for it
but a console message. `README.md` has the table of what is allowed and why.

There is no nonce, because these pages are static and a nonce would force a render per
request. That is why `script-src` carries `'unsafe-inline'`. Do not add a nonce without
moving the pages to dynamic rendering, and note that middleware is called `proxy.ts` in
this version of Next.

## Tests

Vitest with Testing Library. Unit tests live in a `__tests__/` folder beside the module
they cover, named `*.test.ts` or `*.test.tsx`.

Behaviour is also described in Gherkin under `features/`. When behaviour changes, update
or add the `.feature` file in the same change.

Hooks that take their collaborators as an argument fix them on the first render. Passing
a freshly built object on every render would otherwise give every callback a new
identity and re-run its effects for as long as the component lives.

## Working agreements

- Never commit straight to `master`. Each task gets its own branch (`feat/...`,
  `fix/...`, `docs/...`) cut from an up-to-date `master`, and reaches `master` through a
  pull request that only merges once CI is green.
- Commit messages in English, conventional style, matching the existing history:
  `feat(gallery): ...`, `fix(session): ...`, `docs: ...`, `chore: ...`.
- Commits are authored under the owner's personal identity, which the history already
  shows. Check `git config user.email` before the first commit in a clone.
- **No AI traces:** no AI `Co-Authored-By`, no "Generated with ..." footers, and no
  mention of AI in commit messages, pull request descriptions, comments or issues.
- Do not push or open a pull request unless asked. Never use `--no-verify`.
- When a change touches a route, a component's contract or a command, update `README.md`
  and this file in the same change.
- Leave `.next/`, `node_modules/` and build output alone.
- Respect the linter and formatter already configured; do not reformat files unrelated
  to the task at hand.

A change that touches both this site and the API needs a pull request in each
repository, and the API's merges first.

## Staying in sync

Pull requests are merged on GitHub with **rebase and merge**, which rewrites the commits
and deletes the branch on the remote. Local SHAs therefore never match the ones that
landed on `master`, and `git branch --merged` will not recognise a branch that was in
fact merged. Without a fetch, the local view is simply wrong.

- Run `git fetch --prune` before starting a task or describing the state of the work.
  Never read `git status`, `git branch -a` or `git log` as the truth without it.
- Then read `git branch -vv`. A local branch marked **`[gone]`** is one whose pull
  request was merged and whose remote branch GitHub deleted; its content is already in
  `origin/master` however the local history looks. Confirm with
  `gh pr list --state merged --head <branch>` when in doubt.
- Clean up such a branch instead of working on it: `git switch master`,
  `git pull --ff-only`, then `git branch -D <branch>` — `-D` is required, because after
  the rebase git does not consider it merged. Check `git diff master..<branch>` first,
  and say so rather than deleting if anything of the branch's own is still unmerged.
- `fetch.prune` is enabled in this clone, so any `git fetch` or `git pull` already drops
  branches that the remote no longer has. A fresh clone needs
  `git config fetch.prune true` again.

## Public photo responses

`GET /photos` returns compact listing items: id, title, dimensions, publication date,
frame, highlights and responsive renditions up to 1280 pixels wide (without upscaling).
Descriptions and technical metadata come from public `GET /photos/:id`, whose
renditions reach 2560 pixels. The browser selects from the supplied renditions using
`srcset` and `sizes`; it does not download every listed URL.

`/manage` loads the selected photo's detail before enabling its editor, preserving
its description and highlights when saving. A failed detail request offers retry
without opening an incomplete editor.

## Photo viewer

`/photo/[id]` (`PhotoViewer`) shows one photo large, filling the window. The page
reads the detail from `GET /photos/:id` and the listing for ordering only. Each side
edge of the window is one tall link with an arrow to the previous or next photo, so
the whole border can be clicked; the arrow keys and a sideways swipe do the same, each
photo at its own shareable URL. A return arrow in the top-left corner and Escape go
back to `/gallery`. Gallery tiles link here.

The title floats over the photo in the serif of the page headings (`Georgia`), white
with a thin dark outline. Title, arrows, return button and quality selector show
together: a left click on the photo hides them all and moving the mouse brings them
back (a few pixels of jitter are ignored); on a touch screen each tap toggles them, and
a swipe never does. Clicks on a control only do that control's job.

The photo sits in its own `frame` from the API (colour and thickness as a percentage
of the short side; `framedLayout` converts that to CSS percentages and fits the framed
box to the screen height). Photos without a frame are shown bare.

The frame is chosen in **Frame** (`FrameFields`) on every Upload card and in the
Photos editor: a switch, four swatches and a colour picker, and separate sliders for
the sides and for top and bottom (0–25 % of the short side). Its preview uses the same
`framedLayout` as the viewer. Turning it off sends `frameColor: null` with both
thicknesses at 0; a replacement form cannot carry null, so it sends only the zero
thicknesses, and a frame without thickness is read back as no frame. The Home
carousel shows each photo inside its frame too.

A fixed corner control (`QualitySelector`) picks one of three levels, each capped at
a rendition width: **Data saver** (960 px), **Standard** (1920 px, the default) and
**Maximum** (the widest the detail response offers, 2560 px). Only these few
renditions are ever requested, which favours browser and CDN caches. The choice is
kept in `localStorage` under `photoQuality` (a per-visitor convenience; reads and
writes are guarded and fall back to memory), and it applies to every photo opened.
Each option carries a small picture drawn in pixel blocks, coarser for Data saver and
finer for Maximum.

The first time a browser opens a photo, a hint without a background says that a click
hides the controls; it fades on its own or with that first click, and is not shown
again (`viewerHintSeen` in `localStorage`, guarded like the quality). The controls,
the edge arrows and the return button light up under the pointer.
Ratings are not part of the viewer yet; comments are (see "Comments").

The **info panel** (`PhotoInfoPanel`) is a white column of its own, in the manner of a
social photo post: beside the photo on wide screens and below it on phones, never over
the photo or its frame. The photo's area (`.photo-viewer__stage`) is a size container,
so the photo shrinks to fit what is left. The ⓘ button toggles the panel; its ✕ and
Escape close it too, and Escape closes the panel before it leaves the photo. Whether
it is open lives outside the viewer (`viewerPanelState`, in memory), because the
route remounts the viewer for every photo: an open panel stays open from photo to
photo and only its content changes, with an empty panel holding its place while the
next photo loads. The return arrow closes it. Top to
bottom it shows the title, the description and the details the API recorded from the
file's EXIF: capture date (in the project's time zone), camera, lens, focal length,
aperture, shutter speed and ISO, written in photographers' notation by `photoDetails`
and left out when missing. The photo's comments follow them (see "Comments"),
and ratings will go between the two. The panel stays
open when a click hides the controls, since hiding it would resize the photo, and
clicking, selecting or dragging inside it neither hides the controls nor swipes.

Each photo chooses the corner of its title (`titlePosition`: bottom left by default,
bottom right, top left or top right) so it does not get lost over a bright or busy
area. It is set in `/manage` under **Title corner in the viewer** and saved with the
other edits.

## Responsive photo delivery

`PhotoImage` uses a native `<img>` with the API's rendition URLs and their exact
width descriptors. It does not pass through the Next image loader or optimizer.
`sizes="auto, ..."` lets supporting browsers use the actual laid-out width; the
fallback covers the phone viewport minus gallery padding and caps desktop estimates
at the maximum row height. Images use native lazy loading and async decoding;
photos near the viewport start loading without eagerly fetching the whole gallery.

URLs are kept unchanged between pages and renders, allowing the browser HTTP cache
to reuse the same rendition. A browser can choose an already cached larger image;
a larger card or zoom can legitimately require another rendition. Listing images
remain capped at 1280 px, so zoom and dense mobile screens can reach that ceiling.
The gallery itself has no quality selector; the viewer does (see "Photo viewer").

A rendition may carry `fallbackUrl`, the same width on the API's other image host.
`PhotoImage` and the viewer use `useImageFallback`: when the image fails to load, the
whole srcset (or the viewer's single URL) switches once to the fallbacks, and never
retries again. Photos on one host only have no fallback and nothing changes.

See [photo delivery verification](docs/photo-delivery-verification.md) for the tested
viewports, synthetic density/zoom budgets, cache observations and remaining limits.

## Rate-limited login and uploads

The API can return `429` with a `Retry-After` delay in seconds. Repositories translate
that response to the domain's `RateLimitError`; the UI explains the wait rather than
calling it an API outage. Invalid or unavailable delay headers use a generic wait
message. Sign-in and upload requests are never automatically replayed.

On an upload rate limit, the current photo remains failed with its edits intact,
remaining queued photos return to draft, and publishing pauses. A manual retry sends
only failed/draft photos, preserving photos already published. Default API quotas
are 10 sign-in attempts/minute per IP, 30 upload attempts/minute per admin account and
5 comments/minute per account.

## Photo maintenance

On `/manage`, **Only photos needing optimization** queries admin-only
`GET /photos/unoptimized`. Pending issues require another upload or export;
`FIXED_ON_UPLOAD` entries remain history rather than pending work. An empty result
is shown as a completed queue.

Choose a **Replacement file** and save to submit the file and edits together using
`POST /photos/:id/file`. The API preserves the record, publication date, relations,
frame and existing crops, and returns new dimensions, renditions and optimization
results. Review crops after changing image proportions. Failures preserve the file
and edits for manual retry; requests are never replayed automatically. A concurrent
replacement returns a conflict requiring reload. Completed replacements leave the
pending list when no issues remain. Normal metadata edits still use `PATCH`.

The header stacks below the desktop breakpoint and allows wrapping between the
logo, navigation and session controls, including the Google sign-in button.

## Account deletion

The account icon opens a disclosure with the signed-in name, email, role, a link to `/account` and sign-out. Escape closes it and returns focus to the icon. A press outside it or tabbing away closes it too; pressing its own text (name, email, the Admin label) leaves it open, since collapsing a disclosure under that press crashes Chromium tabs. The account page loads
`GET /auth/me/deletion-preview` before offering deletion and requires an explicit
confirmation. The last administrator sees a warning that restoring administrative
access requires contacting the database administrator; deletion remains available
once acknowledged. The API rechecks that condition when processing the deletion.

`DELETE /auth/me` sends only `confirmLastAdmin`, with session credentials. Successful
deletion clears shared session state and disables Google auto-select. Failures keep
the current UI session; conflicts require reviewing the warning and acknowledging
again, without automatically replaying a destructive request. Every server session
is invalidated, while published gallery photographs and the Google account remain.
Signing in again creates a new viewer account without restoring administrator access.
The account's comments stay, without its name, as written by a deleted user.
The privacy notice remains a separate pending task.

## Comments

The info panel ends with the photo's comments (`PhotoComments`): small cards stacked
oldest first, under the divider and without a heading, with the box docked at the
bottom of the panel. Nothing is said when there are none yet. Anyone
can read approved comments; a signed-in visitor also sees their own while they wait
for moderation, marked **Awaiting moderation**, and can delete their own at any time.
A comment whose author deleted their account keeps its text and is shown as written by
a **Deleted user**: the API sends no name, and the words come from this site.

Only signed-in visitors with a public name can write. The form shows which name the
comment will carry, with a pencil linking to `/account` to change it. The box grows
with its text, and its placeholder rotates through a few invitations while it is
empty. **Enter** sends (from the box or the arrow button) and **Shift+Enter** breaks
the line. A sent comment first waits 5 seconds as a card with **Cancel and edit** (the
send stops and the text goes back to the box) and **Send now**, and a note that a moderator will review
it; closing the panel or changing photo during that wait sends it anyway. Unsent text
is kept per photo while the page is open (`commentDrafts`, in memory only), so moving
to another photo and back does not lose it. An own comment awaiting moderation offers
**Cancel**; once approved, **Delete**. Comments go through
`POST /photos/:id/comments` and start pending: nothing appears publicly until the
administrator approves it. The API rejects links, hidden control characters and more
than 1000 characters, and allows 5 comments per minute per account; the panel explains
each refusal and keeps the text so nothing is lost. Requests are never replayed.

On `/account`, **Public name** (`PublicNameSettings`) chooses how comments are signed:
first name and initial (the default, e.g. "Ana G."), the full name from Google, or an
alias of 2 to 40 characters. Only the forms the API can build from the account are
offered; an alias can always be written. The name is fixed on each comment when it is
sent, so a change applies to new comments only. The save goes through
`PATCH /auth/me/public-name` and its answer replaces the session's user
(`replaceUser`) without asking `/auth/me` again.

`/moderate` (`CommentModeration`), linked from `/upload`, is the administrator's queue
from `GET /comments/pending`: each comment with its author, date and a link to its
photo, to **Approve** (`POST /comments/:id/approve`) or **Delete** (which is how a
comment is rejected). The page is offered to the administrator alone; the API enforces
it on every request.

## Curator

`EditingWorkspace` (inside the root session provider) registers dirty photo and
collection editors, confirms save/discard actions, guards links and history, and
installs a native `beforeunload` guard. `EditingBoundary` reuses it or supplies a
local provider for standalone editors. Visited photo editors and collection editors
retain their state while rendering no form when inactive; do not discard these
instances on selection or filter changes. Individual saves never flush other drafts.
Curator remembers only its selected tab in `sessionStorage` (`curatorSection`), not
form data. Drafts and replacement files remain in memory only.

`ManageCollections` splits the catalog editor into Collections and Categories tabs; Collections stays mounted so its drafts survive the other tabs.
`CollectionWorkspace` shows the collection grid with its side panel and owns the
collection editors; `CollectionCanvas` is the editable mosaic (drag to reorder,
edges and corner to resize, click to select), and every pointer gesture has a
side-panel equivalent. Photos are added from `PhotoPicker`, a horizontal strip of
lazily loaded thumbnails capped at 160 px, and the Photos tab's library sits in a
scrolling card; both use `PhotoFilters` (title search ignoring case and accents,
category from the catalog, and on Photos the camera from the admin listing). Their
administrative images are capped at 160 px for thumbnails (the API's smallest
rendition), 320 px for collection cards, 640 px for the
canvas and single previews, and 960 px for the crop editor. Their
styles live in `catalogStudio.css`, imported by the components that use them, not in
`globals.css`. An entry's `showTitle` hides its caption in the public
mosaic, and the collection's `description` appears above it in the gallery. The
admin photo listing includes visibility for collection warnings, while the public compact listing does not. Contact's `noValidate` form
checks validity and shows English errors itself; email ownership is still unverified.

`/curator` (`Curator`) is the administrator's workspace, offered in the header as
**Curator** with a badge counting comments awaiting moderation and unread contact
messages. `CuratorNotificationsProvider` (in `app/layout.tsx`, inside
`SessionProvider`) asks `GET /curator/notifications` for the administrator only,
every minute, when the window regains focus, and whenever a curator action dispatches
a `curator:refresh` event.

Its tabs are **Upload**, **Photos**, **Collections**, **Variants**, **Moderation** and **Inbox**: the
screens of `/upload`, `/manage`, the collection editor and `/moderate`, plus the contact
inbox. Upload, Photos and Collections stay mounted once visited, so switching tabs
does not lose unsaved edits. The older routes still work on their own.

- **Upload**: every card has its own **Upload** button at its bottom right, and the
  list has **Upload All (n)** above and below the cards.
- **Classification** (`PhotoClassificationFields`), on each upload card and in the
  Photos editor: visibility (**Public** by default, **Private**, **Select** — reserved
  for special accounts and, until they exist, private — and **Collections only**),
  categories typed by name with the existing ones suggested and a comma closing each
  one as a chip, and collections chosen from a list, each with the photo's position
  (from 1; new ones default to the end). It reads the full catalog from
  `GET /catalog/manage`.
- **Collections**: a grid of collection cards (cover and title) with a side panel
  of the chosen one's details, then an editor whose canvas is the composition.
  Removing a photo only marks it; the whole collection, cover included, is saved at
  once.
- **Inbox** (`ContactInbox`): messages from `/contact`, newest first, unread ones
  marked, to mark as read or delete.

**Private photos.** The API keeps private and select photos in the image host's
authenticated delivery and serves their renditions itself, as paths on its own origin
(`/photos/:id/renditions/:width`). `ApiPhotoRepository` turns those paths into full
URLs, and the API's origin is in `img-src` for that reason. The public gallery never
receives them; the visibility filter is the API's, not this site's.

## Contact form

`/contact` (`ContactForm`) is linked from the header for everyone. It sends name,
email, message and an explicit consent to `POST /contact`, which keeps the message in
the administrator's inbox; **no email is sent**. Links are refused, and the API allows
3 messages per minute per IP. A refusal keeps the message in the form.

## Collection management

The Collections tab in `/curator` is the admin catalog editor. `/collections` is the public collection grid. `EditCatalog`
uses `CatalogRepository` and `ApiCatalogRepository`; components do not fetch directly.
`GET /catalog` carries collection entries, categories, work variants and photo category
assignments without image URLs. Existing photo use cases supply the renditions.
`selectCatalog` applies category/collection filters and groups each work into one tile.
`CollectionMosaic` shares its four-column, proportionally scaled composition between
the editor preview and the public gallery, with no breakpoint rearrangement.
Each tile can select a variant while retaining the collection's dimensions. Photos
keep their own viewer links and comments. Admin edits preserve their fields on failed
writes, deletion confirms removal of the grouping, and only the API decides access.
See README for endpoints and the required API migration.


## Interactive browsing and variant assignment

Home features a manually controlled carousel of up to eight recent public photos,
with previous/next controls, position buttons and keyboard arrows. It never advances
automatically. Header links react to hover and keyboard focus; the current route is
marked. Gallery groups category chips into Subjects, Color & treatment and Themes, with unrecognized names in Other. Empty groups are hidden; All photographs clears the selection.
Categories uses selectable cards showing photo counts.

**Variants** is a peer of Upload, Photos and Collections in Curator. Select a work's
cover to edit its members as thumbnails. Upload cards can choose an existing photo
as their variant target before publishing; the new file extends that photo's group
or starts a two-file work. Upload and grouping are separate requests: a failed link
keeps the uploaded result, and retry never reuploads the file. Photos offers an
explicit **Save variant assignment** action independent of metadata saving.
Existing groups are edited in the Variants panel, not silently merged.

The collection editor can replace an entry with a variant, retaining layout,
caption visibility and cover selection. The viewer offers variant thumbnails,
including collection-only variants available through the public catalog and detail
endpoint. Category filtering keeps only matching variants and chooses a matching
photo for each work's single tile. A dedicated color/monochrome classification and
filter remains a future addition.


## Multiple photo highlights

`PhotoHighlights` retains optional `square`, `landscape` and `portrait` crops,
and adds `custom?: { id, name, crop: { x, y, width, height } }[]` (up to 20).
Upload and Photos share `HighlightEditor`: add or duplicate a crop, name it,
select it, drag its position and edit its width and height independently in pixels.
The size slider preserves its current ratio. Pixel dimensions describe the image
being edited; persisted coordinates remain normalized and scale with upload resizing.
Custom crops never replace the main thumbnail presets automatically. Each custom
crop has an independent preview and deletion action. Existing photos require no
migration; the API must support `custom` before the updated client is used.

## Home banner

Curator Home edits shared Home appearance through ManageHomeBanner and
ApiHomeBannerRepository (`GET`/admin `PUT /home/banner`). HomePage renders both the
public design and the editor preview. Settings live in the API, not browser storage.
The API validates the complete design and rejects stale versions with 409. Home keeps
the original appearance if settings cannot be loaded; the editor requires a successful
load before saving. Preview changes never publish until Save banner is pressed.

BannerComposition replaces the placement dropdown with pointer/touch and keyboard
block placement. bannerPresets contains local font stacks and palette presets.
HomePage supports framed/fill/highlight modes with independent desktop/mobile crops;
the crop source uses normalized highlight coordinates, then covers the banner.
Container queries keep the real page and embedded mobile preview consistent.
Horizontal swipes suppress link activation; vertical gestures keep scrolling.

Home preview photos open per-photo banner settings with named custom crops, ratio filtering and independent desktop/mobile selection. Drag the actual Welcome and Photographs areas to rearrange them; placement buttons remain available. The active slide loads public photo detail (renditions up to 2560 px). Highlight previews show the downloaded rendition and effective crop pixels, warning when display density requires upscaling. Home has no exterior banner padding.

Home studio uses icon controls with accessible names and selected-state labels, a shared target display for photo settings and preview, mouse-drag/key carousel navigation and valid native composition drop targets. Photo highlights can be edited and saved directly in Home with version protection and unsaved-change handling. ResolutionBadge is shared by Home, Upload and Photos highlight editing; it reports reference uses at 1× pixel sizes (thumbnail, phone, HD monitor/Home, 4K screen), not a guarantee of optical sharpness.

Home adds fixed selected placement controls, icon framing choices, optional Welcome overlay with shade and height sliders, dot/thumbnail/progress navigation and overlay controls. Resolution labels use pixel categories rather than devices. Per-slide captions and destinations support photos, gallery, category, collection and external HTTPS links. Gallery and Collections read the corresponding query parameter on entry.


## Catalog reliability and shared reads

Collection and work updates send the version originally loaded from the catalog.
Successful saves adopt the returned version; stale writes keep the draft and explain
that the catalog changed. Collection Reload state confirms before discarding edits;
Reload catalog can restore the saved variant group after confirmation. Versions are
opaque and may advance by more than one after composition changes.

Collection cards obtain public covers together from `GET /photos/covers`; opening a
collection still loads its contents. Classification cards share one lazily loaded
catalog within the workspace, reload on catalog changes or window focus, and reset
on account changes. Concurrent repository reads share only the in-flight request;
completed responses and authorization are not persistently cached. `usePhotoFetch`
accepts only the latest active request, including during retries and filter changes.
Deploy the API's `20261027000000_audit_reliability` migration and API changes before
this client. Existing Home and Gallery presentation preferences are preserved.


## Server pagination

Gallery uses BrowsePhotos and the bounded `/photos/browse` contract, not GetAllPhotos.
The server filters category, title/category search and presentation rules before
pagination, grouping variants into one tile. Keep the seed between page requests.
Do not restore client-only pagination or load the full photo catalog for the viewer's
arrow order. Home requests eight groups, collections sixty. Gallery only requests
category metadata for its controls. Gallery aborts obsolete reads, debounces search
350 ms and guards pagination while loading and for 500 ms between changes; the API's
90 requests/minute/IP limit remains the server-side protection. Collection composition
references are distinct from the bounded photo payload.

Node is pinned to 24.22.1 LTS in both repositories. Turbopack's experimental workerThreads
plugin runtime avoids the failing local PostCSS child-process socket handshake on
Windows; retain the default Turbopack build and review this option with Next upgrades.
