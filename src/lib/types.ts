export type MediaType = "image" | "video";

/** One row of the `public.uploads` table. */
export interface UploadRow {
  id: string;
  storage_path: string;
  uploader_name: string | null;
  media_type: MediaType;
  poster_path: string | null;
  created_at: string;
}
