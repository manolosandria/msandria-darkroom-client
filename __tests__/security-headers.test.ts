import { describe, expect, it } from "vitest";
import {
  SecurityHeader,
  contentSecurityPolicy,
  securityHeaders,
} from "../security-headers";

const API_URL = "https://api.galeria.example";

function policy(apiUrl: string | undefined = API_URL, isDevelopment = false) {
  return contentSecurityPolicy(apiUrl, isDevelopment);
}

function directiveIn(policyText: string, name: string) {
  return policyText
    .split("; ")
    .find((entry) => entry.startsWith(`${name} `) || entry === name);
}

function directive(name: string, apiUrl = API_URL, isDevelopment = false) {
  return directiveIn(policy(apiUrl, isDevelopment), name);
}

function headerNamed(name: string, isDevelopment = false) {
  return securityHeaders(API_URL, isDevelopment).find(
    (header: SecurityHeader) => header.key === name,
  );
}

describe("contentSecurityPolicy", () => {
  it("allows nothing it has not been asked to allow", () => {
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("form-action")).toBe("form-action 'self'");
  });

  // Click-stealing works by putting this site in a frame the visitor cannot see.
  it("refuses to be framed by anybody", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  // The page is useless if it cannot reach the API, and the API is on another origin.
  it("lets the page call the API it was built for", () => {
    expect(directive("connect-src")).toContain(API_URL);
  });

  // A path says nothing to a policy, and leaving it in would not match the origin.
  it("keeps only the origin of the API URL", () => {
    expect(directive("connect-src", "https://api.galeria.example/v1/photos")).toContain(
      "https://api.galeria.example ",
    );
    expect(directive("connect-src")).not.toContain("/v1/photos");
  });

  // A build with no API URL is already broken; a policy built from a broken URL would
  // be quietly wider than it reads.
  it("leaves the API out when its URL is missing or unreadable", () => {
    const withoutApi = "connect-src 'self' https://accounts.google.com/gsi/";

    expect(
      directiveIn(contentSecurityPolicy(undefined, false), "connect-src"),
    ).toBe(withoutApi);
    expect(directive("connect-src", "not a url")).toBe(withoutApi);
  });

  // Signing in has to keep working: Google's script, the frame it draws its button in,
  // the stylesheet it brings and the calls it makes.
  it("allows what signing in with Google needs, and no more of Google than that", () => {
    expect(directive("script-src")).toContain(
      "https://accounts.google.com/gsi/client",
    );
    expect(directive("style-src")).toContain(
      "https://accounts.google.com/gsi/style",
    );
    expect(directive("frame-src")).toBe(
      "frame-src https://accounts.google.com/gsi/",
    );
    expect(directive("connect-src")).toContain("https://accounts.google.com/gsi/");
  });

  it("allows photos from the image host alone", () => {
    expect(directive("img-src")).toBe(
      "img-src 'self' data: blob: https://res.cloudinary.com",
    );
  });

  it("serves its own fonts and nothing else", () => {
    expect(directive("font-src")).toBe("font-src 'self'");
  });

  // Next writes its bootstrap script into the HTML, and a component sets a custom
  // property as a style attribute. Both are inline, and both are this site's own.
  it("allows the inline script and style this site serves itself", () => {
    expect(directive("script-src")).toContain("'unsafe-inline'");
    expect(directive("style-src")).toContain("'unsafe-inline'");
  });

  describe("in development", () => {
    // React rebuilds error stacks with eval while developing, and never in production.
    it("allows eval only there", () => {
      expect(directive("script-src", API_URL, true)).toContain("'unsafe-eval'");
      expect(directive("script-src")).not.toContain("'unsafe-eval'");
    });

    it("allows the socket that pushes reloads", () => {
      expect(directive("connect-src", API_URL, true)).toContain("ws:");
      expect(directive("connect-src")).not.toContain("ws:");
    });

    // It would rewrite the http API of a local machine to https, and nothing would load.
    it("does not upgrade requests to https there, but does in production", () => {
      expect(policy(API_URL, true)).not.toContain("upgrade-insecure-requests");
      expect(policy()).toContain("upgrade-insecure-requests");
    });

    // The same trap as above, sprung by a production build aimed at a local API.
    it("does not upgrade requests when the API itself is served over http", () => {
      expect(policy("http://localhost:3001")).not.toContain(
        "upgrade-insecure-requests",
      );
    });
  });
});

describe("securityHeaders", () => {
  it("sends the policy", () => {
    expect(headerNamed("Content-Security-Policy")?.value).toBe(policy());
  });

  it("tells the browser not to guess the type of a response", () => {
    expect(headerNamed("X-Content-Type-Options")?.value).toBe("nosniff");
  });

  it("refuses the frame again, for the browsers that read only this", () => {
    expect(headerNamed("X-Frame-Options")?.value).toBe("DENY");
  });

  // Sign-in checks which origin called it, so the header cannot be dropped altogether;
  // what another site never learns is which page the visitor was on.
  it("hands another site the origin and never the page", () => {
    expect(headerNamed("Referrer-Policy")?.value).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  // A browser ignores it over HTTP, so sending it while developing says nothing.
  it("pins the site to https in production only", () => {
    expect(headerNamed("Strict-Transport-Security")?.value).toContain(
      "max-age=63072000",
    );
    expect(headerNamed("Strict-Transport-Security", true)).toBeUndefined();
  });
});
