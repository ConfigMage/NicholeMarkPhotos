import * as tus from "tus-js-client";
import {
  BUCKET,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  supabase,
} from "./supabase";
import type { MediaType } from "./types";

/** 500 MB per-file cap — matches the Storage bucket limit. */
export const MAX_BYTES = 524_288_000;

/** Supabase's TUS implementation REQUIRES exactly a 6 MB chunk size. */
const CHUNK_SIZE = 6 * 1024 * 1024;

/** Human-friendly file size, e.g. "12.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

/** Detect HEIC/HEIF by MIME type or extension (iOS often omits the MIME). */
export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

/** image | video, defaulting unknown image-ish HEIC to "image". */
export function detectMediaType(file: File): MediaType {
  if (file.type.startsWith("video/")) return "video";
  return "image";
}

/** Strip anything that could break a storage object key; keep it readable. */
export function sanitizeFilename(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+/, "")
      .slice(-120) || "file"
  );
}

/**
 * Convert HEIC/HEIF to JPEG in the browser (dynamic import — heic2any is
 * browser-only and heavy). Returns the original file unchanged if not HEIC.
 */
export async function maybeConvertHeic(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  const heic2any = (await import("heic2any")).default;
  const converted = (await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  })) as Blob | Blob[];
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg") || "photo.jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

/**
 * Best-effort client-side video thumbnail: load into a hidden <video>, seek to
 * ~1s, paint a frame onto a <canvas>, export JPEG. Resolves to `null` on any
 * failure (mobile codecs are flaky) so callers can fall back to a play-icon tile.
 */
export function generatePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    let objectUrl: string | null = null;

    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(blob);
    };

    try {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      objectUrl = URL.createObjectURL(file);

      // Give up if the device never decodes the file.
      const timer = setTimeout(() => finish(null), 12_000);

      video.onloadedmetadata = () => {
        const target = Math.min(1, (video.duration || 2) / 2);
        // Setting currentTime triggers a seek -> onseeked.
        try {
          video.currentTime = Number.isFinite(target) ? target : 0;
        } catch {
          clearTimeout(timer);
          finish(null);
        }
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx || !canvas.width || !canvas.height) {
            clearTimeout(timer);
            return finish(null);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              clearTimeout(timer);
              finish(blob);
            },
            "image/jpeg",
            0.8,
          );
        } catch {
          clearTimeout(timer);
          finish(null);
        }
      };

      video.onerror = () => {
        clearTimeout(timer);
        finish(null);
      };

      video.src = objectUrl;
    } catch {
      finish(null);
    }
  });
}

/**
 * Resumable upload straight from the browser to Supabase Storage over TUS.
 * NOTE: bytes never pass through any Next.js / Vercel function — that path caps
 * request bodies at ~4.5 MB. tus-js-client auto-resumes after dropped connections.
 */
export function tusUpload(
  data: File | Blob,
  objectName: string,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(data, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: CHUNK_SIZE,
      metadata: {
        bucketName: BUCKET,
        objectName,
        contentType,
        cacheControl: "3600",
      },
      onError: (error) => reject(error),
      onProgress: (sent, total) => {
        if (onProgress && total > 0) {
          onProgress(Math.round((sent / total) * 100));
        }
      },
      onSuccess: () => resolve(),
    });

    // Resume a matching interrupted upload if tus-js-client remembers one.
    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) {
          upload.resumeFromPreviousUpload(previous[0]);
        }
        upload.start();
      })
      .catch(() => upload.start());
  });
}

/** Upload a small JPEG poster directly via the Storage REST API (browser -> Supabase). */
export async function uploadPoster(
  posterPath: string,
  blob: Blob,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(posterPath, blob, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });
  if (error) throw error;
}

/** Insert the metadata row that makes the file appear in the live gallery. */
export async function insertUploadRow(row: {
  storage_path: string;
  uploader_name: string | null;
  media_type: MediaType;
  poster_path: string | null;
}): Promise<void> {
  const { error } = await supabase.from("uploads").insert(row);
  if (error) throw error;
}

/** Build a collision-proof object key: `<uuid>-<sanitized-name>`. */
export function buildObjectName(filename: string): string {
  return `${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}
