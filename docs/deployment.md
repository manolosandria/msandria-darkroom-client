# Deploying the web on Cloudflare

Status: **not deployed.** This page evaluates how this Next.js 16 app can run on
Cloudflare and what each gallery's build needs. Nothing here creates accounts or
resources, and no Cloudflare tooling has been added to the project yet.

Each gallery is its own installation: its own API, its own domain and its own build of
this site. The API side (image, Fly.io configuration, gallery manifest and release
pipeline) is documented in the API repository.

## Is this site static?

Almost, but not entirely.

Every page is a client component: the HTML that Next.js produces is a shell, and the
browser fetches photos, collections, posts and the session from the API after the page
loads. Most routes (`/`, `/gallery`, `/collections`, `/curator`, `/account`, …) are
therefore generated once, at build time, as plain files. `next build` marks them `○`
(static).

Two things still need a server:

1. **Routes with an id in the path.** `/photo/[id]`, `/post/[id]` and `/profile/[id]`
   cannot be generated in advance because the ids only exist in each gallery's
   database, which the build never sees. Next.js renders them when they are requested
   (`ƒ`, dynamic). A static export only accepts dynamic routes whose every value is
   listed at build time with `generateStaticParams()`.
2. **Security headers.** The Content-Security-Policy and the other headers in
   `security-headers.ts` are sent by the Next.js server through `headers()` in
   `next.config.ts`. A static export ignores `headers()`; the host would have to send
   them itself.

The Next.js documentation shipped with this version
(`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, "Unsupported
Features") lists both as unsupported in `output: "export"`, together with rewrites,
redirects, proxy, Server Actions and image optimization with the default loader. This
app uses none of the others: there is no `proxy.ts`, no route handler, no Server Action,
and the only `next/image` with the default loader is the SVG logo, which Next serves as
is.

What this means in practice: the site can run on Cloudflare either **with a small
server** (a Worker running Next.js) or **as plain files** after changing those two
things. Both are described below.

## Options

### A. OpenNext on Cloudflare Workers (works without code changes)

The [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) adapter turns the
`next build` output into a Worker plus static assets. It runs the real Next.js server, so
the dynamic routes and `headers()` keep working exactly as in `next start`.

- Version support: recent releases accept Next.js 16.2.3 or later in the 16.x line (this
  app uses 16.3.6). Check the adapter's peer range again when adopting it.
- The Next.js docs list Cloudflare among platforms *working towards* a verified adapter
  built on the Next.js Adapter API; the OpenNext adapter is Cloudflare's own integration
  and is not verified by the Next.js team yet.
- Cloudflare now recommends [vinext](https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs/)
  (a Vite-based reimplementation of the Next.js API) for new projects. It is in beta;
  not a candidate for production yet.
- Cost: the Workers Free plan allows 10 ms of CPU time per request. Rendering a dynamic
  route with Next.js can exceed that, so plan on the Workers Paid plan for every
  Cloudflare account that hosts a gallery (including a client's own account).

Minimal setup, **not added yet** because it adds dependencies and can only be checked by
running `wrangler`:

- Dependencies: `@opennextjs/cloudflare` and, as a dev dependency, `wrangler`.
- `wrangler.jsonc` per gallery (or one file with an environment per gallery):

  ```jsonc
  {
    "$schema": "node_modules/wrangler/config-schema.json",
    "name": "darkroom-<gallery>-web",
    "main": ".open-next/worker.js",
    "compatibility_date": "<the date the setup is tested>",
    "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
    "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
    "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "darkroom-<gallery>-web" }]
  }
  ```

- `open-next.config.ts` with `defineCloudflareConfig()` and no incremental cache: the
  site has no ISR and no `fetch` cache to persist, so no R2 binding is needed for Next.
- `package.json` scripts: `preview` (`opennextjs-cloudflare build && opennextjs-cloudflare preview`)
  and `upload` (`opennextjs-cloudflare build && opennextjs-cloudflare upload`), the latter
  creating a new Worker version that can be promoted and rolled back.
- `.open-next` in `.gitignore`.
- The image optimizer is not used (`/_next/image` would need a Cloudflare Images
  binding); keep the photos on the API's ready-made URLs as today.

### B. Static export (cheaper, needs code changes)

Because every page already fetches its data in the browser, the site could become plain
files served by Workers static assets, with no server at all:

- Move the id from the path to the query string (`/photo?id=…`, `/post?id=…`,
  `/profile?id=…`) and update the links that build those URLs, or serve one generic page
  for every `/photo/*` path with a host rule. Old links would need a redirect.
- Generate a `_headers` file at build time with the same headers `security-headers.ts`
  produces today, so the CSP still names this gallery's API and image hosts.
- Set `output: "export"`.

This removes the per-request CPU cost and the Worker runtime from the picture, and each
gallery's build becomes a folder of files. It is the better long-term target; it is not
done here because it changes routes that other work is touching.

## One build per gallery

`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` are written into the JavaScript
bundle when `next build` runs, and `IMAGE_ORIGINS` plus `NEXT_PUBLIC_API_URL` are written
into the Content-Security-Policy. Changing them later on the host has no effect. So:

- Every gallery needs **its own build** of each version, made with that gallery's
  values. The same commit produces a different artifact per gallery.
- A version's artifact is identified by both: `<gallery>` + `vX.Y.Z`.
- Rolling back means re-promoting the previous build of that gallery (Worker versions
  keep it), not rebuilding.

| Variable | Value for a gallery |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.<gallery domain>` (same registrable domain as the site, or the session cookie is not sent) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The OAuth client id the gallery's API also has in `GOOGLE_CLIENT_ID` |
| `IMAGE_ORIGINS` | `https://img.<gallery domain>`, the domain in front of the gallery's public R2 bucket |

The site's exact origin (for example `https://www.<gallery domain>`) must be listed in
the API's `CORS_ORIGINS` and `WEB_ORIGIN` and in the OAuth client's "Authorized
JavaScript origins".

## Not verified

- No Cloudflare build or preview was run: neither option has been tried yet.
- The CPU time of a dynamic route under OpenNext has not been measured.
