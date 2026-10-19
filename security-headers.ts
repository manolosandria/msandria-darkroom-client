// The headers every page of this site is served with. They are instructions to the
// browser, not defences on the server: the response is the same either way, but the
// browser stops doing with it what it should not. The Content-Security-Policy is the
// one with substance — it lists the only places a script, a style, an image or a
// connection may come from, so an injected tag has nowhere to load from.
//
// No nonce here on purpose. A nonce has to be new on every request, which means every
// page has to be rendered on every request; all four pages of this site are static, and
// trading that away buys little for a public gallery. The honest cost of staying static
// is `'unsafe-inline'` for scripts: Next writes its own bootstrap script into the HTML.
// Everything else stays closed, and the day these pages need rendering per request, the
// nonce goes in a `proxy.ts` and `'unsafe-inline'` comes straight out of here.

// The script that renders the official "Sign in with Google" button, the frame it draws
// itself in and the calls it makes. Google documents these three as what its sign-in
// needs from a policy.
const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
const GOOGLE_IDENTITY_STYLE = "https://accounts.google.com/gsi/style";
const GOOGLE_IDENTITY = "https://accounts.google.com/gsi/";

// Photos are delivered by the API's image host, and nothing else is ever loaded from it.
const IMAGE_HOST = "https://res.cloudinary.com";

export type SecurityHeader = { key: string; value: string };

// The API lives on another origin, so it has to be named for the browser to let the page
// call it. Only the origin goes in the policy: a path means nothing to CSP. An unset or
// unreadable value leaves it out — the page would not work anyway, and a broken URL in
// the policy would quietly widen it.
function apiOrigin(apiUrl: string | undefined): string | null {
  try {
    return new URL(apiUrl ?? "").origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(
  apiUrl: string | undefined,
  isDevelopment: boolean,
): string {
  const api = apiOrigin(apiUrl);
  const directives = [
    "default-src 'self'",
    // 'unsafe-eval' is React's doing in development: it rebuilds error stacks with it.
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} ${GOOGLE_IDENTITY_SCRIPT}`,
    // Tailwind ships a stylesheet, but a component still sets a custom property inline
    // to keep each photo's proportion, and a style attribute counts as an inline style.
    `style-src 'self' 'unsafe-inline' ${GOOGLE_IDENTITY_STYLE}`,
    `img-src 'self' data: blob: ${IMAGE_HOST}${api ? ` ${api}` : ""}`,
    // next/font downloads Geist at build time and serves it from this origin.
    "font-src 'self'",
    // In development the extra scheme is the socket `next dev` pushes reloads through.
    `connect-src 'self'${api ? ` ${api}` : ""} ${GOOGLE_IDENTITY}${isDevelopment ? " ws:" : ""}`,
    // Google draws its button inside its own frame; nothing else may be framed.
    `frame-src ${GOOGLE_IDENTITY}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // This site is never to be embedded: that is how a click is stolen.
    "frame-ancestors 'none'",
  ];
  // Upgrading every insecure request is right in production and wrong against an API
  // served over plain http: it would rewrite those calls to https and nothing would
  // answer. So it goes in unless this very policy had to name an insecure origin, which
  // is the case while developing and in a production build pointed at a local API.
  if (!isDevelopment && !api?.startsWith("http://")) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

export function securityHeaders(
  apiUrl: string | undefined,
  isDevelopment: boolean,
): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(apiUrl, isDevelopment),
    },
    // The browser must not guess the type of a response: a file served as an image is
    // never to be run as a script.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Same as frame-ancestors, for the browsers that only read this one.
    { key: "X-Frame-Options", value: "DENY" },
    // Another site learns which site sent the visitor, never which page they were on.
    // Sign-in checks the origin, so dropping the header altogether is not an option.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];
  if (!isDevelopment) {
    // Two years, and every subdomain: once a browser has been here, it never talks to
    // this site over plain HTTP again. A browser ignores it over HTTP, which is why it
    // is not worth sending while developing.
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }
  return headers;
}
