# msandria-darkroom-client

Web client of my photography gallery: the public gallery, the photo viewer with comments, the contact form and the administrator's workspace (`/curator`). The API that stores the catalogue lives in a separate repository, `msandria-darkroom-api`; this site only ever talks to it, never to the image host's credentials.

It is also where I practise clean architecture: `src/` is split into `domain` (entities and repository interfaces), `application` (use cases), `infrastructure` (the API repositories) and `ui` (components and hooks).

## Running

Day to day, with everything already installed (the first time on a machine, start with [Installation](#installation)).

1. **Start the API first.** In another terminal, from `msandria-darkroom-api`, run `npm run start:dev` and wait for `Nest application successfully started` (see that repository's README). Without it the gallery has nothing to show and sign-in fails.
2. **Move into this folder.** `npm` commands run inside `msandria-darkroom-client`, not in the folder that holds both repositories, which has no `package.json`.
3. If you use `nvm`, switch to the version in `.nvmrc` (`nvm use` in bash; with `nvm-windows`, `nvm use 20.20.2`, since it does not read `.nvmrc`).
4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000). Pages reload as you edit.

Keep the site on port 3000: it is the origin the API allows in `CORS_ORIGINS` and the one registered with Google for sign-in. If Next says *Another next dev server is already running*, one is already serving this folder; use it, or stop it before starting another.

If a change to a stylesheet does not show up even after a hard reload, the dev server
is serving an old copy from its own cache, not the browser's. Stop it and start it with
`npm run dev:clean`, which deletes `.next/dev` before starting.

### Checks before a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

CI runs the same on Linux with the Node version in `.nvmrc`.

## Installation

Once per machine.

### Tools

- **Node 20.20.2**, the version in `.nvmrc` and the one CI uses. The easy way is `nvm` (WSL, Linux, macOS) or `nvm-windows`. Other versions usually run, but they are not what CI checks.
- **Git**.
- **`msandria-darkroom-api`** installed and running locally, following its own README (Postgres or a Neon development branch, Cloudinary and Google credentials).
- A **Google OAuth client id** of type "Web application", the same one the API uses, with `http://localhost:3000` under "Authorized JavaScript origins".

### Steps

1. Install the Node version and the dependencies. With `nvm` in WSL, Linux or macOS:

   ```bash
   nvm install
   nvm use
   npm ci
   ```

   With `nvm-windows`, pass the version, since it does not read `.nvmrc`:

   ```powershell
   nvm install 20.20.2
   nvm use 20.20.2
   npm ci
   ```

2. Create `.env.local` from the template (`cp .env.example .env.local` in bash; `Copy-Item .env.example .env.local` in PowerShell) and fill it in: `NEXT_PUBLIC_API_URL` points at msandria-darkroom-api (`http://localhost:3001` in development), and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` holds the same OAuth client id the API has in `GOOGLE_CLIENT_ID`. Both are inlined when the bundle is built, so restart `npm run dev` after changing them, and set them before building for production.
3. Continue with [Running](#running).

## Tech stack

- Next.js 16 (App Router, Turbopack) and React 19
- TypeScript
- Tailwind CSS 4
- Vitest and Testing Library for the tests; Gherkin scenarios in `features/`
- Images come from the API as rendition URLs; there is no image-host SDK in this repository

This version of Next.js has breaking changes from older ones: read the guides in `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`).

## Security headers

Every page is served with the headers in `security-headers.ts`, wired up by `next.config.ts`. They are instructions to the browser, not defences on the server: the response is the same either way, but the browser stops doing with it what it should not.

The one with substance is the `Content-Security-Policy`, which lists the only places anything may be loaded from — so a tag someone manages to inject has nowhere to load from. What is allowed, and why it has to be:

| Directive | Allowed | Why |
|---|---|---|
| `script-src` | this origin, inline, `accounts.google.com/gsi/client` | Next writes its bootstrap script into the HTML, and Google's script draws the sign-in button |
| `style-src` | this origin, inline, `accounts.google.com/gsi/style` | `PhotoGrid` sets each photo's proportion as a style attribute, which counts as inline |
| `img-src` | this origin, `data:`, `blob:`, `res.cloudinary.com`, `NEXT_PUBLIC_API_URL` | Photos come from the API's image host; private ones, from the API itself |
| `connect-src` | this origin, `NEXT_PUBLIC_API_URL`, `accounts.google.com/gsi/` | The page is useless if it cannot call the API, which is on another origin |
| `frame-src` | `accounts.google.com/gsi/` | Google draws its button inside its own frame |
| everything else | nothing | `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` |

Alongside it: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security` in production.

**No nonce, on purpose.** A nonce has to be new on every request, which would mean rendering every page on every request; every page fetches its data in the browser, so none needs it today, and that trade buys little for a public gallery. The price of staying static is `'unsafe-inline'` for scripts. The day these pages need rendering per request, the nonce goes in a `proxy.ts` — Next's name for middleware in this version — and `'unsafe-inline'` comes straight out.

While developing, the policy also allows `'unsafe-eval'` (React rebuilds error stacks with it) and the socket `next dev` pushes reloads through. `upgrade-insecure-requests` is left out whenever the API itself is served over plain http, or it would rewrite those calls to https and nothing would answer.

These headers come from the Next.js server. A deploy that serves the build as plain files has to be configured to send them itself.

## Signing in

The header offers a "Sign in with Google" button. Google Identity Services hands the page a signed ID token, which goes to the API's `POST /auth/google`; the API verifies it and answers with a session in an `HttpOnly` cookie.

That cookie is deliberately out of this code's reach, so the page cannot tell whether a session exists by looking at it: it asks `GET /auth/me` instead, and every call to the API carries `credentials: "include"` so the browser attaches the cookie. The API has to allow this site's origin in `CORS_ORIGINS` and answer with `Access-Control-Allow-Credentials`.

**The role only decides what the interface offers.** `User.isAdmin()` drives the "Admin" mark and whether the **Curator** link and its screens are offered — it never decides what is allowed. The API settles that on every request by reading the role from its own database, so editing anything in the browser changes nothing but the view.

There is no client secret and no redirect URI in this flow. In the Google console, this site's origin goes under "Authorized JavaScript origins" (`http://localhost:3000` in development); the redirect URI fields stay empty.

## Editing the current photo version

Photos keeps an independent in-memory draft for each visited photo, including a
replacement file. Switching photos, filters or Curator tabs preserves it. Save and
Cancel changes controls appear above and below the editor and ask for confirmation;
Accept also works with Enter. Confirmations appear in a centered overlay; clicking
outside it or pressing Escape cancels and preserves the draft. Each collection likewise keeps its own draft and
removal selections; saving one never submits other collections.

Leaving an editor through a link or browser history with pending edits offers
**Save all and leave**, **Cancel**, or **Leave without saving**. A failed save keeps
the page and remaining drafts. Closing or reloading the tab uses the browser's own
unsaved-change warning; browsers do not allow a custom three-button dialog there.
Drafts live only in memory and do not survive an accepted reload or departure.
The selected Curator tab is restored from `sessionStorage` after reloading.

Private or reserved photos assigned to collections show a warning: their order
does not make them visible in public collections. Contact uses its own English
validation messages rather than browser-localized tooltips. Email format is checked;
ownership verification is not implemented yet.

Photo details carry a `version`. Saves and replacements send that version and only
metadata that differs from the loaded photo. A stale edit receives a conflict and
the card says: “This photo changed while you were editing it. Reload its state before
saving.” Edits remain available until the administrator chooses **Reload state**.
Successful replacements return the full classification and new version, so reopening
a private photo preserves its visibility, categories and collection placements.

**Order** in Photos is a placement within an assigned collection, not a global photo
order. Moving or removing a photo renumbers that collection consecutively; oversized
positions append at the end. Collections continues to save its entire composition.

## Publishing a photo

`/upload` is the administrator's form, also the **Upload** tab of `/curator` (see [Curator](#curator)), and the header only offers the "Curator" link to an administrator. Both are conveniences: the API answers `POST /photos` with a refusal for anyone else, so nothing here is what keeps the gallery closed.

The file is sent as `multipart/form-data` exactly as it came off the disk, with no `Content-Type` header of our own — only the browser knows the boundary that separates the parts. Nothing is resized or stripped in the browser: the API's upload pipeline resizes the photo, converts it to sRGB and removes every tag, the GPS location included, before the file ever reaches the image host. Doing any of that here would only destroy the evidence the API reports back.

That report is the `optimizationIssues` the answer carries, and the page splits it in two. Issues marked `FIXED_ON_UPLOAD` are a log of how the export came in — the stored file is already fine — while `NEEDS_REUPLOAD` and `NEEDS_REEXPORT` are shown as something still worth doing.

Each issue arrives as a measurement and the unit it was measured in, never as a sentence: a whole number of `BYTES`, `PIXELS` or `TAG_COUNT`, or the code the API read off the file for `FILE_FORMAT` and `COLOR_SPACE`. `OptimizationIssueList` is what turns that into English — bytes into megabytes, a count into "2 tags", and a label and a line of advice per kind. A unit or a kind this build has never heard of is printed as it came rather than hidden.

## The upload workspace and highlights

`/upload` takes several photos at once, by drop or picker, and each one gets its own panel: an editable title and description, a preview, the file's own measurements and, once published, the optimization report described above. Publishing walks the queue one request at a time: a photo the API refuses keeps its edits and is the only one retried, the ones that went up stay published, and the page has to stay open until the queue finishes.

Highlights are optional crops, placed by hand: square (1:1), landscape (3:2) and portrait (2:3). Drag the frame or use the sliders, which are the keyboard way in. Nothing is cropped automatically, and any of the three may be left out. They are stored as fractions of the oriented photo, so the same numbers hold against the original and against every rendition.

`/manage` edits what is already published — title, description and crops — with `PATCH /photos/:id`, and never uploads a file again. Its square thumbnails crop a normal rendition with the square highlight when there is one, and centre it when there is not. Like every other screen, it only ever shows renditions the API handed it.

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
are 10 sign-in attempts/minute per IP, 30 upload attempts/minute per admin account,
5 comments/minute per account and 3 contact messages/minute per IP.

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

The account icon opens a disclosure with the signed-in name, email, role, a link to `/account` and sign-out. Escape closes it and returns focus to the icon. The account page loads
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
- **Collections**: the catalog editor's own tabs, **Collections** and **Categories**, each in a raised card. Collections opens on a grid of cards (cover
  and title) beside a side panel showing the chosen collection's categories,
  description and photo thumbnails, with **Edit collection**; a **New collection**
  card starts an empty one. Removing a photo only marks it; the whole collection,
  cover included, is saved at once.
- **Photos**: the published photos sit in a card of their own, with a title search
  (case and accents ignored), category and camera filters and a vertical scroll, so
  the editor beside it stays in view. The camera comes from the admin listing's
  `camera` (make and model).
- **Inbox** (`ContactInbox`): messages from `/contact`, newest first, unread ones
  marked, to mark as read or delete.

**Private photos.** The API keeps private and select photos in the image host's
authenticated delivery and serves their renditions itself, as paths on its own origin
(`/photos/:id/renditions/:width`). `ApiPhotoRepository` turns those paths into full
URLs, and the API's origin is in `img-src` for that reason. The public gallery never
receives them; the visibility filter is the API's, not this site's.

## Contact

`/contact` (`ContactForm`) is linked from the header for everyone. It sends name,
email, message and an explicit consent to `POST /contact`, which keeps the message in
the administrator's inbox; **no email is sent**. Links are refused, and the API allows
3 messages per minute per IP. A refusal keeps the message in the form.

## Collections and variants

The Collections tab in `/curator` is the administrator's catalog editor. It
creates and edits categories, assigns categories to standalone photos, builds
collections, orders their photos, and sets each tile's width and height from one
to four cells. The collection editor (`CollectionCanvas`) is itself the
composition, on the same four-column canvas as the gallery: a photo is dragged to
a new place, resized by pulling its right edge, bottom edge or corner, and clicked
to show its details in the side panel. Photos are added from **Add photos**, a
horizontal strip of small thumbnails with their titles, filtered by title and
category; thumbnails load lazily as the strip scrolls and never request more than a
160-pixel rendition. Clicking one appends it to the composition and selects it,
showing its details in the side panel — position, width and height, **Show title
in the collection**, **Use as collection cover** and removal. Each of those also
works from the panel without a pointer. Private and reserved photos carry a framed
**!** on the canvas and a warning above it. The collection's own title,
description (up to 2000 characters, shown above the collection in the gallery) and
categories fill the panel when no photo is selected. The entire composition scales
down on phones without changing the arrangement. Photos remain uncropped inside
each tile. Empty collections are allowed.

The gallery reads the public `GET /catalog` alongside the existing photo listing.
Category filters include directly classified photos and photos in classified
collections; selecting a collection uses its saved order and sizes. An empty
selection is explicit. Catalog loading failures offer a retry while the ordinary
photo gallery remains usable.

The editor also groups two or more files as variants of one work. Each file keeps
its viewer URL and comments. The gallery shows one tile per work with a selector
that changes both its image and link. In a collection, the first entry for that
work determines its initial variant and tile dimensions. Unavailable files are
omitted. Deleting a grouping never deletes photographs.

`EditCatalog` uses the `CatalogRepository` interface; `ApiCatalogRepository` sends
session credentials for all calls. Writes use `POST`, `PATCH`, and `DELETE` on
`/collections`, `/categories`, and `/works`, plus `PATCH /photos/:id/categories`.
The API enforces administrator permissions. Failed saves keep the edited fields
and are never replayed automatically; deletion requires confirmation.
Apply the API's `20261018000000_collections` and `20261021000000_collection_studio`
migrations before using this feature.

## Public browsing

The header links separately to Gallery and Collections. Gallery shuffles the public
photos once per load, keeps that order across pages of twelve, and offers a compact
category filter that returns to page one. Collections opens with responsive cards
showing each collection's cover, title and description; opening one shows its saved
mosaic and a return button. Catalog editing remains in Curator.


## Interactive browsing and variant assignment

Home features a manually controlled carousel of up to eight recent public photos,
with previous/next controls, position buttons and keyboard arrows. It never advances
automatically. Header links react to hover and keyboard focus; the current route is
marked. Gallery includes category chips and a compact select for longer lists.
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
