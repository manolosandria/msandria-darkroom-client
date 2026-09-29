import { NextRequest, NextResponse } from "next/server";
import { signUploadParams } from "@/src/infrastructure/cloudinarySignature";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export async function POST(request: NextRequest) {
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on the server." },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title");
  const description = formData.get("description");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const context = `title=${title.trim()}${
    typeof description === "string" && description.trim() ? `|description=${description.trim()}` : ""
  }`;
  const signature = signUploadParams({ context, timestamp }, API_SECRET);

  const uploadForm = new FormData();
  uploadForm.set("file", file);
  uploadForm.set("api_key", API_KEY);
  uploadForm.set("timestamp", timestamp);
  uploadForm.set("context", context);
  uploadForm.set("signature", signature);

  const cloudinaryResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: uploadForm },
  );

  if (!cloudinaryResponse.ok) {
    return NextResponse.json({ error: "Cloudinary rejected the upload." }, { status: 502 });
  }

  const result = await cloudinaryResponse.json();

  return NextResponse.json({
    id: result.public_id,
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : undefined,
    url: result.secure_url,
  });
}
