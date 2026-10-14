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

Node version is pinned in `.nvmrc`. `nvm-windows` does not read that file, so on Windows
the version has to be named by hand: `nvm use 20.20.2`.

`.env.local` is ignored by git and must never be committed. Two variables, both
inlined into the client bundle at build time, so both must be set **before** a
production build:

- `NEXT_PUBLIC_API_URL` — base URL of the API, no trailing slash. The API must list this
  site's origin in its own CORS configuration.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — the OAuth client id, the same value the API verifies
  tokens against. Not a secret: it only says which application a token was issued for.

There is no client secret and no redirect URI in this project, and none belongs in this
repository. See "Sessions" below.

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
| `app/` | Routes: `/` (home), `/gallery`, `/upload`, `/manage` |
| `src/domain/` | Entities (`Photo`, `User`) and repository interfaces |
| `src/application/` | Use cases, one class each |
| `src/infrastructure/` | Repository implementations, the HTTP client, service wiring |
| `src/ui/` | Components and hooks |
| `features/` | Gherkin scenarios describing behaviour |

Dependencies point inwards: `domain` knows nothing of the others, `application` depends
only on `domain` interfaces, and `infrastructure` supplies the implementations. A
component reaches the API through a use case, never with its own `fetch`.

`/upload` publishes through the API's `POST /photos` and is offered in the header to
the administrator alone. `/manage` edits what is already published, through `PATCH
/photos/:id`, and is reached from a link on `/upload` rather than from the header.

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
