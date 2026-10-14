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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
