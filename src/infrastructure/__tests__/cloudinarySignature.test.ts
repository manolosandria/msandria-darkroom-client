import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signUploadParams } from "../cloudinarySignature";

describe("signUploadParams", () => {
  it("hashes params sorted alphabetically, per Cloudinary's signing rule", () => {
    const signature = signUploadParams({ timestamp: "123", context: "title=A" }, "secret");
    const expected = createHash("sha1").update("context=title=A&timestamp=123secret").digest("hex");

    expect(signature).toBe(expected);
  });

  it("is independent of the order params are provided in", () => {
    const a = signUploadParams({ timestamp: "123", context: "title=A" }, "secret");
    const b = signUploadParams({ context: "title=A", timestamp: "123" }, "secret");

    expect(a).toBe(b);
  });

  it("produces different signatures for different secrets", () => {
    const params = { timestamp: "123" };

    expect(signUploadParams(params, "a")).not.toBe(signUploadParams(params, "b"));
  });
});
