# msandria-darkroom-client

Web client of my photography gallery. The API that stores the catalogue lives in a separate repository, `msandria-darkroom-api`.

## What's this?

Essentially, this project is the frontend for my photographer's web gallery (work in progress). 

At this moment, there's only an initial structure with some domain entities and repository interfaces. 

## Why?

In the short term, my goal is to learn and practice good architectural methodologies. For that reason, I'm using clean architecture. 

In the future, I hope to have created a site with well designed architecture and UI, with good scalability and modularity. So it can be replicated on other sites with high functionality and personalization. 

But one step at a time :) 

## Tech Stack

- Next.js (React) 
- TypeScript 
- Node.js 

Planned:
- Tailwind CSS
- Cloudinary


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Copy `.env.example` to `.env.local` and fill it in first: `NEXT_PUBLIC_API_URL` points at msandria-darkroom-api, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` holds the same OAuth client id the API has in `GOOGLE_CLIENT_ID`. Both are inlined at build time, so they must be set before building for production.

## Security headers

Every page is served with the headers in `security-headers.ts`, wired up by `next.config.ts`. They are instructions to the browser, not defences on the server: the response is the same either way, but the browser stops doing with it what it should not.

The one with substance is the `Content-Security-Policy`, which lists the only places anything may be loaded from — so a tag someone manages to inject has nowhere to load from. What is allowed, and why it has to be:

| Directive | Allowed | Why |
|---|---|---|
| `script-src` | this origin, inline, `accounts.google.com/gsi/client` | Next writes its bootstrap script into the HTML, and Google's script draws the sign-in button |
| `style-src` | this origin, inline, `accounts.google.com/gsi/style` | `PhotoGrid` sets each photo's proportion as a style attribute, which counts as inline |
| `img-src` | this origin, `data:`, `blob:`, `res.cloudinary.com` | Photos come from the API's image host |
| `connect-src` | this origin, `NEXT_PUBLIC_API_URL`, `accounts.google.com/gsi/` | The page is useless if it cannot call the API, which is on another origin |
| `frame-src` | `accounts.google.com/gsi/` | Google draws its button inside its own frame |
| everything else | nothing | `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` |

Alongside it: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Strict-Transport-Security` in production.

**No nonce, on purpose.** A nonce has to be new on every request, which would mean rendering every page on every request; all four pages are static today, and that trade buys little for a public gallery. The price of staying static is `'unsafe-inline'` for scripts. The day these pages need rendering per request, the nonce goes in a `proxy.ts` — Next's name for middleware in this version — and `'unsafe-inline'` comes straight out.

While developing, the policy also allows `'unsafe-eval'` (React rebuilds error stacks with it) and the socket `next dev` pushes reloads through. `upgrade-insecure-requests` is left out whenever the API itself is served over plain http, or it would rewrite those calls to https and nothing would answer.

These headers come from the Next.js server. A deploy that serves the build as plain files has to be configured to send them itself.

## Signing in

The header offers a "Sign in with Google" button. Google Identity Services hands the page a signed ID token, which goes to the API's `POST /auth/google`; the API verifies it and answers with a session in an `HttpOnly` cookie.

That cookie is deliberately out of this code's reach, so the page cannot tell whether a session exists by looking at it: it asks `GET /auth/me` instead, and every call to the API carries `credentials: "include"` so the browser attaches the cookie. The API has to allow this site's origin in `CORS_ORIGINS` and answer with `Access-Control-Allow-Credentials`.

**The role only decides what the interface offers.** `User.isAdmin()` drives the "Admin" mark and, later, which panels appear — it never decides what is allowed. The API settles that on every request by reading the role from its own database, so editing anything in the browser changes nothing but the view.

There is no client secret and no redirect URI in this flow. In the Google console, this site's origin goes under "Authorized JavaScript origins" (`http://localhost:3000` in development); the redirect URI fields stay empty.

## Publishing a photo

`/upload` is the administrator's form, and the header only offers the "Upload" link to an administrator. Both are conveniences: the API answers `POST /photos` with a refusal for anyone else, so nothing here is what keeps the gallery closed.

The file is sent as `multipart/form-data` exactly as it came off the disk, with no `Content-Type` header of our own — only the browser knows the boundary that separates the parts. Nothing is resized or stripped in the browser: the API's upload pipeline resizes the photo, converts it to sRGB and removes every tag, the GPS location included, before the file ever reaches the image host. Doing any of that here would only destroy the evidence the API reports back.

That report is the `optimizationIssues` the answer carries, and the page splits it in two. Issues marked `FIXED_ON_UPLOAD` are a log of how the export came in — the stored file is already fine — while `NEEDS_REUPLOAD` and `NEEDS_REEXPORT` are shown as something still worth doing.

Each issue arrives as a measurement and the unit it was measured in, never as a sentence: a whole number of `BYTES`, `PIXELS` or `TAG_COUNT`, or the code the API read off the file for `FILE_FORMAT` and `COLOR_SPACE`. `OptimizationIssueList` is what turns that into English — bytes into megabytes, a count into "2 tags", and a label and a line of advice per kind. A unit or a kind this build has never heard of is printed as it came rather than hidden.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## The upload workspace and highlights

`/upload` takes several photos at once, by drop or picker, and each one gets its own panel: an editable title and description, a preview, the file's own measurements and, once published, the optimization report described above. Publishing walks the queue one request at a time: a photo the API refuses keeps its edits and is the only one retried, the ones that went up stay published, and the page has to stay open until the queue finishes.

Highlights are optional crops, placed by hand: square (1:1), landscape (3:2) and portrait (2:3). Drag the frame or use the sliders, which are the keyboard way in. Nothing is cropped automatically, and any of the three may be left out. They are stored as fractions of the oriented photo, so the same numbers hold against the original and against every rendition.

`/manage` edits what is already published — title, description and crops — with `PATCH /photos/:id`, and never uploads a file again. Its square thumbnails crop a normal rendition with the square highlight when there is one, and centre it when there is not. Like every other screen, it only ever shows renditions the API handed it.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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

The signed-in name in the header links to `/account`. The account page loads
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

## Collections and variants

`/collections`, linked from `/upload`, is the administrator's catalog editor. It
creates and edits categories, assigns categories to standalone photos, builds
collections, orders their photos, and sets each tile's width and height from one
to four cells. A live preview uses the same four-column canvas as the gallery;
the entire composition scales down on phones without changing the arrangement.
Photos remain uncropped inside each tile. Empty collections are allowed.

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
Apply the API's `20261018000000_collections` migration before using this feature.
