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

## Signing in

The header offers a "Sign in with Google" button. Google Identity Services hands the page a signed ID token, which goes to the API's `POST /auth/google`; the API verifies it and answers with a session in an `HttpOnly` cookie.

That cookie is deliberately out of this code's reach, so the page cannot tell whether a session exists by looking at it: it asks `GET /auth/me` instead, and every call to the API carries `credentials: "include"` so the browser attaches the cookie. The API has to allow this site's origin in `CORS_ORIGINS` and answer with `Access-Control-Allow-Credentials`.

**The role only decides what the interface offers.** `User.isAdmin()` drives the "Admin" mark and, later, which panels appear — it never decides what is allowed. The API settles that on every request by reading the role from its own database, so editing anything in the browser changes nothing but the view.

There is no client secret and no redirect URI in this flow. In the Google console, this site's origin goes under "Authorized JavaScript origins" (`http://localhost:3000` in development); the redirect URI fields stay empty.

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
