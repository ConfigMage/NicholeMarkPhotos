import { BUCKET, supabase } from "./supabase";

/** Full-resolution public URL for an object (used in the lightbox / video player). */
export function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * A resized thumbnail via Supabase's image transformation endpoint (Pro feature).
 * Used for grid tiles so we never ship full-res photos into the masonry.
 */
export function thumbUrl(path: string, width = 400): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path, {
    transform: {
      width,
      resize: "contain",
      quality: 72,
    },
  }).data.publicUrl;
}

/**
 * A public URL that forces a browser download (sets Content-Disposition: attachment
 * via Supabase's `?download=` query param). Cross-origin `download` attributes are
 * otherwise ignored, so this is the reliable way to make the Download button save.
 */
export function downloadUrl(path: string, filename: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path, {
    download: filename || true,
  }).data.publicUrl;
}
