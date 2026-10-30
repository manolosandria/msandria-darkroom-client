# msandria-darkroom-client

Web client of my photography gallery: the public gallery, the photo viewer with comments, the contact form and the administrator's workspace (`/curator`). The API that stores the catalogue lives in a separate repository, `msandria-darkroom-api`; this site only ever talks to it, never to the image host's credentials.

It is also where I practise clean architecture: `src/` is split into `domain` (entities and repository interfaces), `application` (use cases), `infrastructure` (the API repositories) and `ui` (components and hooks).

## Running

Day to day, with everything already installed (the first time on a machine, start with [Installation](#installation)).

1. **Start the API first.** In another terminal, from `msandria-darkroom-api`, run `npm run start:dev` and wait for `Nest application successfully started` (see that repository's README). Without it the gallery has nothing to show and sign-in fails.
2. **Move into this folder.** `npm` commands run inside `msandria-darkroom-client`, not in the folder that holds both repositories, which has no `package.json`.
3. If you use `nvm`, switch to the version in `.nvmrc` (`nvm use` in bash; with `nvm-windows`, `nvm use 24.22.1`, since it does not read `.nvmrc`).
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

- **Node 24.22.1**, the version in `.nvmrc` and the one CI uses. The easy way is `nvm` (WSL, Linux, macOS) or `nvm-windows`. Other versions usually run, but they are not what CI checks.
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
   nvm install 24.22.1
   nvm use 24.22.1
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
| `img-src` | this origin, `data:`, `blob:`, `res.cloudinary.com`, the https origins in `IMAGE_ORIGINS`, `NEXT_PUBLIC_API_URL` | Photos come from the API's image hosts (Cloudinary, and R2's domain when set at build time); private ones, from the API itself. If a photo fails on one host, the page tries the `fallbackUrl` the API gave for the other, once |
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
area. It is set in `/manage` under **Title corner in the viewer**, by choosing a corner on a small copy of the photo, and saved with the
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

**Replace file…**, the last section of the editor, chooses a replacement; a warning says the current file
will be lost and **Keep the current file** withdraws it. Save to submit the file and edits together using
`POST /photos/:id/file`. The API preserves the record, publication date, relations,
frame and existing crops, and returns new dimensions, renditions and optimization
results. Review crops after changing image proportions. Failures preserve the file
and edits for manual retry; requests are never replayed automatically. A concurrent
replacement returns a conflict requiring reload. Completed replacements leave the
pending list when no issues remain. Normal metadata edits still use `PATCH`.

The header stacks below the desktop breakpoint and allows wrapping between the
logo, navigation and session controls, including the Google sign-in button.

A chevron beside the account icon folds the header away (`MainHeader`); a slim bar of
the header's colour stays in its place with a centred **Menu** tab that brings it back,
so the page moves rather than being covered. Focus follows to whichever control remains,
the folded header is `inert`, and reduced motion drops the animation. The choice is kept
in `localStorage` under `headerHidden` (`headerPreference`, guarded like the photo
quality and falling back to memory); a remembered choice applies without animating.
For the administrator, the Menu tab carries a dot and announces pending notifications.

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
collections, orders their photos, and sets each piece's width and height in cells
of an eight-column grid (one to eight; new photos start at two by two). The
collection editor (`CollectionCanvas`) is itself the composition, on the same canvas
as the public collection: a piece is dragged to a new place, resized by pulling its
right edge, bottom edge or corner (its size shows while it changes), and clicked to
show its details in the side panel. Faint column guides mark the grid.

**Phones.** The public mosaic switches to four columns when its container is
narrower than 640 px. A piece without its own phone size takes one derived from the
wide size with its proportion kept (`mobileSpan`: a 2×2 photo stays 2×2, half the
phone's width; an 8×4 one becomes 4×2). **Wide screens / Phones** above the canvas
switches the editor to a phone frame on four columns, in the same order; resizing a
piece there, or ticking **Own size on phones**, gives it its own phone size, and
unticking it follows the wide size again.

**Text.** **Add text block** inserts a text after the selected piece: a heading,
paragraph or quote, aligned left, centre or right, sized and moved like a photo
(`TextDetails`). A text is stored by the number of photos before it, so it stays
ahead of the same photo when photos are added or removed elsewhere; an empty block
keeps the collection from saving. A photo can also carry **Text with the photo**
(up to 500 characters): it shows under the photo inside the same piece, and
hovering or focusing the piece outlines and lifts photo and text together.
`collectionLayout` merges photos and texts into one reading order for the editor and
splits them back into `entries` and `texts` for the API; on a paged collection,
`textsForPage` shows each text on the page of the photo it precedes.

The **New collection** card is a slow plasma of the site's greens under a glass
plus, still when the visitor asks for reduced motion. Photos are added from **Add photos**, a
horizontal strip of small thumbnails with their titles, filtered by title and
category; thumbnails load lazily as the strip scrolls and never request more than a
160-pixel rendition. Clicking one appends it to the composition and selects it,
showing its details in the side panel — position, width and height, **Show title
in the collection**, **Use as collection cover** and removal. Each of those also
works from the panel without a pointer. Private and reserved photos carry a framed
**!** on the canvas and a warning above it. The collection's own title,
description (up to 2000 characters, shown above the collection in the gallery) and
categories fill the panel when no photo is selected. Photos remain uncropped inside
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

Home features a manually controlled carousel with previous/next controls, position
buttons and keyboard arrows. It shows the slides chosen in **Curator → Home →
Slides** (`BannerSlideList`: up to eight public photographs, in order); without
slides it draws up to eight eligible photos at random on each visit, one per work. A
click on the photo only focuses the carousel for the arrow keys, without a focus
frame; the slide title is the link to its photo, page or external destination. It
never advances automatically. Header links react to hover and keyboard focus; the current route is
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

### Home banner studio

Open **Curator → Home** as an administrator to edit the welcome text, four colors,
title font and size, text alignment and placement, and banner corners (rectangle,
rounded or arch). Preview desktop/mobile layouts, save for all visitors, cancel a
draft, or restore the original design. Fonts use local system stacks. The carousel
continues to show the eight newest public photographs with their individual frames.
The API stores the shared design at `/home/banner`; apply its HomeBanner migration
first. Failed saves preserve the draft; outdated versions offer an explicit reload.
Unsaved edits participate in the Curator leave-page protection.

### Home slides, Welcome over the photograph and arranging

**Slides** sit under the Home preview and are managed like a collection
(`BannerSlideList`): a strip of public photographs (searched by title, accents
ignored) adds one with a click, each slide is a card with its thumbnail, a **Slide
title** and a **Link destination** (`SlideDestination`: this photograph, Gallery, a
category, a collection or an HTTPS address), and cards reorder by dragging their ⠿
grip, by arrow keys on the grip or with ← →. Up to eight. A card warns when its
photograph has no framing enabled for Home, since Home skips it. Clicking a card's
thumbnail shows that slide in the preview, and the card of the slide on show is marked.

**Composition** above the preview chooses the layout from five drawings
(`BannerLayoutPicker`). **Welcome over photo** opens `WelcomePanelControls`: a 3 × 3
position grid, width (25–90 % of the banner), panel style (solid, frosted glass, soft
fade or text only), panel and text colors with a swap, panel opacity and corner radius.
They are saved as `welcome` in the banner; without it the panel keeps its earlier look
(bottom left, half width, black at the saved opacity). On phones the panel spans the
width and keeps its vertical position. Over the photograph, the slide title moves to
the side Welcome leaves free.

In the preview, Welcome and Photographs carry a ⠿ grip (`BannerArrange`). Dragging one
draws the drop map over the banner: edge bands put Welcome beside the photographs and,
for Welcome, nine anchors inside float it over them; the target lights up and a label
follows the pointer naming it. A press without movement changes nothing and Escape
cancels. Arrow keys on a grip do the same: Welcome walks the nine anchors while it is
over the photographs and leaves for an edge past the last one. Changes animate with
view transitions where the browser has them, and not under reduced motion. The preview
column scrolls on its own on wide screens, so composition, preview and slides stay in
reach.

### Gallery appearance studio

Curator → Gallery edits up to 12 introduction blocks (empty text is hidden), font and
size per block, the general palette, category groups and optional category-specific
font/palette/layout overrides. Preview desktop or phone, then Save gallery to apply.
Cancel and restore operate on the draft. Failed and stale saves preserve it; reload
requires confirmation if dirty. Category groups expand on mouse hover, keyboard click
or touch and close on selection, blur or Escape.

`GET /gallery/settings` is public with no-store; `PUT /gallery/settings` requires
administration and the current `version` (409 on conflict). Settings reuse the existing
HomeBanner JSON table with the independent key `gallery`, so no migration is needed
after the Home banner migration. Nothing changes the Home record. Fonts are local
system stacks (Georgia, Arial, Courier). Categories without overrides inherit the
general appearance; unassigned categories use vocabulary grouping with Other as fallback.

Photo layouts: justified natural proportions, uniform grid, or stable random emphasis
with at most two large tiles per page. Size and spacing are configurable. Phone mosaics
keep multiple smaller tiles; grid crops affect thumbnails only. Variant selectors and
viewer links remain available. Header navigation keeps its site-wide appearance.

### Random presentation choices

Photos → Highlights shows each original/crop with independent Gallery and Home
checkboxes. Existing photos default to the original in both places; creating a crop
does not enable it automatically. Empty destination lists exclude the photo there.
Choices are part of `highlights.presentation: { gallery: string[], home: string[] }`;
references are `original`, `square`, `landscape`, `portrait` or `custom:<id>`.
Deleting a crop in Curator removes its destination references. The API validates
unique references to existing crops; save/replacement retain existing version checks.
This is an extension of the existing JSON column and requires no migration.

Gallery chooses an enabled view per photo, then packs a complete rectangle for
wide and narrow screens. Portrait views occupy two rows; enabled horizontal/square
views can use a small tile. Packing keeps at most two emphasis tiles and falls back
to balanced full-width bands for unusual sets. Images are not repeated to fill gaps.
The shuffled selection, chosen crops and layout stay stable during page navigation.
Search matches photo titles or assigned category names and returns to page one.
The introduction places search and compact category menus alongside the text on
wide screens and underneath on phones. Home shuffles eligible photos once per load
and uses only an enabled original/crop, preserving full-photo viewer links.
Gallery keeps the visitor's place in the URL (`category`, `q`, `page`, `layout`,
`crops`) and its shuffle seed in `sessionStorage` (`gallerySeed`), so returning from a
photo restores the same page and order. Opening a photo from Gallery, a collection or
Home stores that order (`viewerSequence`, per tab), and the viewer's arrows follow it;
otherwise they use the API's chronological neighbours. Arrow keys and Escape typed in a
field, such as the comment box, never move the viewer. While the next page or filter loads, the previous
tiles stay on screen, dimmed, instead of the grid disappearing.

### Visitor gallery controls and palette library

Visitors choose Squares, Random emphasis (initial default) or Natural proportions,
then Combined / Square / Rectangular views. Curator can also offer Portrait and
Landscape individually and disable any distribution or view filter, retaining at
least one option in each group. `visitorOptions` stores `layouts` and `crops`.
The category's saved layout is its initial choice when enabled; visitor choices
override it for the visit. Natural proportions use the selected view's real aspect
ratio. The count sits beside the grid, outside category hover menus, whose options
attach directly to their buttons.

Photos Highlights expands each view's Distribution & aspect eligibility matrix.
Optional `highlights.presentation.galleryRules` contains up to nine unique
`{ layout, aspect, views }` cells, with `aspect` portrait / square / landscape.
Columns describe the original or highlight's actual aspect ratio: make a separate
crop to offer another aspect. Omitted rules inherit the previous Gallery list;
when rules exist, missing cells are disabled. References must also be enabled in the
overall Gallery list. Home is independent. Removing a crop removes its references.
The square layout uses square tiles; Natural proportions preserves native framing.
The matrix and filters do not change image quality or delivery limits.

Curator Gallery starts with Archive, Night and Sand palettes. Apply copies colors to
the current general/category design; edit names/colors, save the current design as
a new palette or delete any library entry. Deleting leaves applied colors intact.
Library and visitor-option edits are drafts until Save gallery, use the existing
optimistic version check and require no database migration.

Home studio also offers six one-click palettes and eight system-font stacks. Arrange
Welcome and Photographs by dragging their handles to the composition board edges,
by selecting a block and destination, or using arrow keys. Touch dragging is confined
to the handles; public carousel swipes leave vertical page scrolling available.
Image presentation can preserve the complete framed photo, fill from the full photo,
or fill from separate desktop/mobile landscape, portrait or square highlights. Missing
highlights fall back to the centered full photo. Fill may trim the chosen area to fit.
The mobile preview uses the same container breakpoints as public Home.

Home preview photos open per-photo banner settings with named custom crops, ratio filtering and independent desktop/mobile selection. Drag the ⠿ grips of Welcome and Photographs to rearrange them; the layout drawings above the preview do the same. The active slide loads public photo detail (renditions up to 2560 px). Highlight previews show the downloaded rendition and effective crop pixels, warning when display density requires upscaling. Home has no exterior banner padding.

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


### Bounded public browsing and Turbopack

Gallery requests twelve groups per page from `GET /photos/browse`, with search,
category and presentation filters applied by the API. A group may carry several
visible variants. The seed keeps random ordering stable while the data set remains
unchanged. Home requests at most eight groups; collections request sixty per page.
The viewer requests only its public neighbors for arrow navigation. Full photo
listings belong to the administrator's panel. The public collection catalog still
contains composition references, without downloading every photo's renditions.

Search waits 350 ms; obsolete Gallery reads are aborted. Pagination blocks while
loading and ignores changes less than 500 ms apart. The API also enforces a
90-requests/minute/IP quota for browsing and neighbors; rejected reads need a manual
retry. Multi-instance deployment needs the shared rate-limit store tracked by the API.

Both repositories use Node **24.22.1 LTS**. `engines` requires the supported 24.x
line; CI reads `.nvmrc`. Install/select that version locally before running npm.
Next 16.3.6 uses the experimental `turbopackPluginRuntimeStrategy: "workerThreads"`
to avoid the PostCSS child-process socket handshake that failed on this Windows
environment. Turbopack remains the default for development and builds. Review this
option on Next upgrades; the successful workaround does not identify the operating
system cause of the socket failure.

## Photos and Variants studios

**Photos** (`ManagePhotos`) opens on the library: a grid of whole photos, sized with a
slider, or a list with visibility, size, camera and publication date. Search, category,
camera and **Needs optimization** sit above it. Opening a photo turns the library into a
filmstrip and shows the editor: a dark stage on the left with the photo large (its title
in the chosen corner) and chips to show any highlight large instead, and an inspector on
the right. The inspector's sections (Details, Visibility, Categories, Collections,
Variants, Frame, Highlights, File) are disclosures. Its sticky header (`PhotoSectionBar`)
puts the title with Save and Cancel on one line, then an even grid of icon tiles, one per
section, at most two rows: a tile opens and scrolls to its section, the one being read is
marked as the page scrolls, and a dot marks each open one. **Expand all**/**Collapse
all** are icon buttons around a meter of how many are open, each disabled when it would
change nothing. **Sections** hides the ones a curator does not use (Details, which holds
the required title, always stays); hidden sections keep their state, the choice is kept
per visitor in `localStorage` under `photoInspectorHiddenSections` (guarded, falling back
to memory), and pending file issues in a hidden section show on that button. Arrow keys,
Home and End move between tiles. On phones the header scrolls with the form. Variants
mounts on first opening, so its catalog loads only then.

`PhotoClassificationFields` exports its parts (`PhotoVisibilityField`,
`PhotoCategoryField`, `PhotoCollectionField`); Upload still uses the whole set.
Visibility is four cards, categories add with a click from the existing ones, and
collections are a disclosure of cover cards that toggle membership, with the order
beside each chosen one (covers come from the `photos` passed in, else an initial).
`VariantAssignment` picks the related photo from thumbnails; `inline` shows it open and
loads at once.

**Variants** (`VariantStudio`) lists works on the left, shows the open work as a large
drop zone and the library as a strip below. Photos join a work by dragging, by ticking
them in the strip, or by dropping image files (or **Upload files…**), which are
uploaded through `UploadPhoto` with the visibility of the work's first photo and added
to the draft. The work is saved only with **Save variants**.

Gallery's visitor controls are segmented icon buttons (native radios), and the Gallery
studio previews inside a monitor or a phone chosen with two device buttons.

## Highlights, palettes and filters

`HighlightEditor` shows every highlight as a thumbnail; choosing one selects it on the
stage, where it moves with the pointer and resizes from its corners (a custom one from
its edges too), keeping a main shape's proportion. The green **+** offers the four
shapes (square, landscape, portrait, free); the curator draws the crop on the photo and
then accepts or cancels it, so nothing is created by a click alone. **Revert** puts back
the crop the highlight had when the editor opened or it was accepted. The sliders stay
under **Precise size and position** for keyboard use. In Photos, choosing a highlight
also shows it large on the stage (`onActiveChange`).

Gallery's categories can be combined: the query sends `categories`, groups separated by
`|` and ids by `,`, and the API returns photos with any category of each chosen group.
The URL keeps them comma-separated in `category`, so a single `?category=` link still
works. The round reset icon clears every filter; the chosen ones show as chips. The first
chosen category with its own look themes the page. The display controls are icons with
the chosen option written underneath, and every control shares one height, radius and
surface from the theme variables.

Variants show as small round thumbnails (`VariantThumbs`) on Gallery tiles, at the
bottom of the viewer, and in a collection mosaic only when the collection's
`showVariants` is on (Collections → Display).

**Palettes** (`PaletteManager`) is a Curator tab that edits the gallery's palette library
and shows, on a small drawing of the page, where each of the four colors goes. It saves
the same settings document as the Gallery studio: each announces its save
(`curator:gallery-settings-saved`) and the other adopts the new palettes and version.
In the Gallery studio, **Type & color** comes first, with the palette drawer under the
colors; the introduction texts are numbered cards.

In Photos → Categories, typing narrows the existing categories shown as buttons and
offers **Create** for a new name; there is no dropdown. The Collections editor follows the
Photos layout: the photo strip on top, the composition on a dark stage and an inspector
of sections (Selected photo, Details, Categories, Display).
