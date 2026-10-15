import { describe, expect, it, vi } from "vitest";
import { Photo } from "@/src/domain/entities/Photo";
import { ApiPhotoRepository } from "../ApiPhotoRepository";

const API_URL = "http://api.test";

// Reads carry the session cookie too: the API decides per route who may see what.
const READ_REQUEST = { method: "GET", credentials: "include" };

function apiPhoto(id: string, renditions = [{ width: 640, url: `https://cdn/${id}-640.jpg` }]) {
  return {
    id,
    title: `Photo ${id}`,
    description: null,
    width: 1920,
    height: 1080,
    format: "jpg",
    capturedAt: null,
    lastEditDate: null,
    origin: "EDITED",
    createdAt: "2024-06-04T23:42:00.000Z",
    renditions,
  };
}

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("ApiPhotoRepository", () => {
  it("reports upload throttling with its retry interval without retrying the request", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "25" } }));
    const repository = new ApiPhotoRepository(API_URL, fetchFn);
    await expect(repository.upload({ file: new File(["x"], "photo.jpg"), title: "Photo" })).rejects.toMatchObject({ name: "RateLimitError", retryAfterSeconds: 25 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("fetches pending reviews with credentials and excludes corrected-only history", async () => {
    const issue = { kind: "LOCATION", resolution: "NEEDS_REUPLOAD", unit: "TAG_COUNT", currentValue: "2", recommendedValue: "0" };
    const fetchFn = respondWith([{ ...apiPhoto("pending"), optimizationIssues: [issue] }, { ...apiPhoto("settled"), optimizationIssues: [{ ...issue, resolution: "FIXED_ON_UPLOAD" }] }]);
    const entries = await new ApiPhotoRepository(API_URL, fetchFn).findUnoptimized();
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos/unoptimized", READ_REQUEST);
    expect(entries.map((entry) => entry.photo.getId())).toEqual(["pending"]);
    expect(entries[0].optimizationIssues[0].isPending()).toBe(true);
  });
  it("replaces in one multipart request with edits and without overriding Content-Type", async () => {
    const fetchFn = respondWith({ ...apiPhoto("a/b"), optimizationIssues: [] });
    const photo = new Photo({ id: "a/b", title: "Coast", description: "Story", width: 1920, height: 1080, renditions: [{ width: 640, url: "https://cdn/old.jpg" }], highlights: {} });
    const file = new File(["image"], "replacement.jpg", { type: "image/jpeg" });
    const result = await new ApiPhotoRepository(API_URL, fetchFn).replace(photo, file);
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe("http://api.test/photos/a%2Fb/file");
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.headers).toBeUndefined();
    expect(options.body.get("file")).toBe(file);
    expect(options.body.get("title")).toBe("Coast");
    expect(options.body.get("description")).toBe("Story");
    expect(options.body.get("highlights")).toBe("{}");
    expect(result.photo.getId()).toBe("a/b");
  });
  it.each([401, 403, 409, 413, 429, 500])("does not replay a rejected replacement (%i)", async (status) => {
    const fetchFn = respondWith({}, status);
    const photo = new Photo({ ...apiPhoto("a"), description: undefined, createdAt: new Date() });
    await expect(new ApiPhotoRepository(API_URL, fetchFn).replace(photo, new File(["x"], "x.jpg"))).rejects.toBeInstanceOf(Error);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  describe("findAll", () => {
    it("maps the API listing into domain photos, keeping its order", async () => {
      const fetchFn = respondWith([apiPhoto("b"), apiPhoto("a")]);

      const photos = await new ApiPhotoRepository(API_URL, fetchFn).findAll();

      expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos", READ_REQUEST);
      expect(photos?.map((photo) => photo.getId())).toEqual(["b", "a"]);
      expect(photos?.[0].getTitle()).toBe("Photo b");
      expect(photos?.[0].getCreatedAt()).toEqual(new Date("2024-06-04T23:42:00.000Z"));
      expect(photos?.[0].urlForWidth(640)).toBe("https://cdn/b-640.jpg");
      expect(photos?.[0].getAspectRatio()).toBeCloseTo(1920 / 1080);
    });

    it("accepts compact listing items without detail fields", async () => {
      const item = { id: "compact", title: "Coast", width: 1800, height: 1200,
        createdAt: "2026-10-15T00:00:00.000Z", highlights: {},
        renditions: [{ width: 1280, url: "https://cdn/coast-1280.jpg" }] };
      const photos = await new ApiPhotoRepository(API_URL, respondWith([item])).findAll();
      expect(photos?.[0].getDescription()).toBeUndefined();
      expect(photos?.[0].getMetadata().format).toBeUndefined();
      expect(photos?.[0].urlForWidth(2560)).toBe("https://cdn/coast-1280.jpg");
    });

    it("tolerates a trailing slash in the base url", async () => {
      const fetchFn = respondWith([]);

      await new ApiPhotoRepository("http://api.test/", fetchFn).findAll();

      expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos", READ_REQUEST);
    });

    it("leaves out photos without renditions", async () => {
      const fetchFn = respondWith([apiPhoto("a"), apiPhoto("gone", [])]);

      const photos = await new ApiPhotoRepository(API_URL, fetchFn).findAll();

      expect(photos?.map((photo) => photo.getId())).toEqual(["a"]);
    });

    it("returns null for an empty catalog", async () => {
      const photos = await new ApiPhotoRepository(API_URL, respondWith([])).findAll();

      expect(photos).toBeNull();
    });

    it("rejects when the API answers with an error", async () => {
      const repository = new ApiPhotoRepository(API_URL, respondWith({}, 500));

      await expect(repository.findAll()).rejects.toThrow(/500/);
    });

    it("rejects with a clear message when the API url is not configured", async () => {
      const fetchFn = vi.fn();

      await expect(new ApiPhotoRepository(undefined, fetchFn).findAll()).rejects.toThrow(
        /NEXT_PUBLIC_API_URL/,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("fetches a single photo by its id", async () => {
      const fetchFn = respondWith(apiPhoto("a/b"));

      const photo = await new ApiPhotoRepository(API_URL, fetchFn).findById("a/b");

      expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos/a%2Fb", READ_REQUEST);
      expect(photo?.getTitle()).toBe("Photo a/b");
    });

    it("returns null when the API does not know the id", async () => {
      const photo = await new ApiPhotoRepository(API_URL, respondWith({}, 404)).findById("x");

      expect(photo).toBeNull();
    });

    it("returns null when the photo has no renditions", async () => {
      const photo = await new ApiPhotoRepository(API_URL, respondWith(apiPhoto("a", []))).findById("a");

      expect(photo).toBeNull();
    });

    it("rejects on any other API error", async () => {
      const repository = new ApiPhotoRepository(API_URL, respondWith({}, 503));

      await expect(repository.findById("a")).rejects.toThrow(/503/);
    });
  });

  describe("unsupported operations", () => {
    const repository = new ApiPhotoRepository(API_URL, vi.fn());

    it("rejects delete with an explicit not-implemented error", async () => {
      await expect(repository.delete("any-id")).rejects.toThrow(/not support/i);
    });

    it("rejects findCollection with an explicit not-implemented error", async () => {
      await expect(repository.findCollection("any-id")).rejects.toThrow(/not support/i);
    });
  });
});

describe("ApiPhotoRepository upload", () => {
  const file = new File(["bytes"], "virgencita.jpg", { type: "image/jpeg" });

  function reviewedPhoto(issues: unknown[] = []) {
    return { ...apiPhoto("new"), optimizationIssues: issues };
  }

  function requestOf(fetchFn: ReturnType<typeof vi.fn>) {
    return fetchFn.mock.calls[0][1] as RequestInit;
  }

  it("posts the photo as multipart with the session cookie", async () => {
    const fetchFn = respondWith(reviewedPhoto(), 201);

    await new ApiPhotoRepository(API_URL, fetchFn).upload({
      file,
      title: "Virgencita",
      description: "Veracruz",
    });

    expect(fetchFn.mock.calls[0][0]).toBe("http://api.test/photos");
    const request = requestOf(fetchFn);
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
    const body = request.body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("title")).toBe("Virgencita");
    expect(body.get("description")).toBe("Veracruz");
  });

  // Only the browser knows the boundary that separates the parts of the body. Writing
  // the header by hand produces a body the API cannot take apart.
  it("leaves Content-Type for the browser to write", async () => {
    const fetchFn = respondWith(reviewedPhoto(), 201);

    await new ApiPhotoRepository(API_URL, fetchFn).upload({ file, title: "Virgencita" });

    expect(requestOf(fetchFn).headers).toBeUndefined();
  });

  it("leaves out a description that was not given", async () => {
    const fetchFn = respondWith(reviewedPhoto(), 201);

    await new ApiPhotoRepository(API_URL, fetchFn).upload({ file, title: "Virgencita" });

    expect((requestOf(fetchFn).body as FormData).has("description")).toBe(false);
  });

  it("returns the published photo with what its file was missing", async () => {
    const fetchFn = respondWith(
      reviewedPhoto([
        {
          kind: "LOCATION",
          resolution: "FIXED_ON_UPLOAD",
          unit: "TAG_COUNT",
          currentValue: "2",
          recommendedValue: "0",
        },
        {
          kind: "UNDERSIZED",
          resolution: "NEEDS_REEXPORT",
          unit: "PIXELS",
          currentValue: "1600",
          recommendedValue: "2048",
        },
      ]),
      201,
    );

    const published = await new ApiPhotoRepository(API_URL, fetchFn).upload({
      file,
      title: "Virgencita",
    });

    expect(published.photo.getId()).toBe("new");
    expect(published.optimizationIssues.map((issue) => issue.getKind())).toEqual([
      "LOCATION",
      "UNDERSIZED",
    ]);
    expect(published.optimizationIssues.map((issue) => issue.isPending())).toEqual([
      false,
      true,
    ]);
  });

  it("accepts an answer that carries no issues at all", async () => {
    const fetchFn = respondWith(apiPhoto("new"), 201);

    const published = await new ApiPhotoRepository(API_URL, fetchFn).upload({
      file,
      title: "Virgencita",
    });

    expect(published.optimizationIssues).toEqual([]);
  });

  // Each refusal means something different to whoever is publishing, so the status is
  // translated before it leaves the repository.
  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [413, "tooLarge"],
    [500, "unreachable"],
  ])("turns %i into a %s failure", async (status, failure) => {
    const repository = new ApiPhotoRepository(API_URL, respondWith({}, status));

    await expect(repository.upload({ file, title: "Virgencita" })).rejects.toMatchObject(
      { failure },
    );
  });

  it("repeats the reason a rejection gives", async () => {
    const fetchFn = respondWith({ message: ["title should not be empty"] }, 400);
    const repository = new ApiPhotoRepository(API_URL, fetchFn);

    await expect(repository.upload({ file, title: " " })).rejects.toMatchObject({
      failure: "rejected",
      message: "title should not be empty",
    });
  });

  it("joins the several reasons a rejection can give", async () => {
    const fetchFn = respondWith({ message: ["no title", "no file"] }, 422);
    const repository = new ApiPhotoRepository(API_URL, fetchFn);

    await expect(repository.upload({ file, title: "" })).rejects.toMatchObject({
      message: "no title. no file",
    });
  });

  it("falls back to its own wording when the rejection explains nothing", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("not json", { status: 400 }));
    const repository = new ApiPhotoRepository(API_URL, fetchFn);

    await expect(repository.upload({ file, title: "Virgencita" })).rejects.toMatchObject(
      { failure: "rejected", message: "The API rejected the photo." },
    );
  });
});


describe("ApiPhotoRepository save", () => {
  const crop = { x: 0, y: 0, width: 0.5, height: 0.5 };

  const publishedPhoto = (overrides: Record<string, unknown> = {}) =>
    new ApiPhotoRepository(
      API_URL,
      respondWith({ ...apiPhoto("crop"), highlights: { square: crop }, ...overrides }),
    ).findById("crop");

  // A save never carries a file: it patches the record the API already has, as JSON,
  // with the session cookie attached like every other call.
  it("patches the title, the description and the crops as JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const photo = await publishedPhoto({ description: "Evening walk" });

    await new ApiPhotoRepository(API_URL, fetchFn).save(photo!);

    expect(fetchFn).toHaveBeenCalledWith(
      `${API_URL}/photos/crop`,
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Photo crop",
          description: "Evening walk",
          highlights: { square: crop },
        }),
      }),
    );
  });

  // The API's own convention for "no description" is null, not an empty string.
  it("clears a description with null rather than an empty string", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const photo = await publishedPhoto({ description: null });

    await new ApiPhotoRepository(API_URL, fetchFn).save(photo!);

    const sent = (fetchFn.mock.calls[0][1] as RequestInit).body as string;

    expect(JSON.parse(sent)).toMatchObject({ description: null });
  });

  it("explains a refusal the same way an upload does", async () => {
    const photo = await publishedPhoto();
    const repository = new ApiPhotoRepository(
      API_URL,
      vi.fn().mockResolvedValue(new Response("nope", { status: 403 })),
    );

    await expect(repository.save(photo!)).rejects.toMatchObject({
      failure: "forbidden",
    });
  });
});
