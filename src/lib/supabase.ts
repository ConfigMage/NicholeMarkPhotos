import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Name of the public Storage bucket (see setup.sql). */
export const BUCKET = "wedding-media";

/** True only when both public env vars are present. */
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * A single shared browser client. We fall back to harmless placeholders when the
 * env vars are missing so that `createClient` doesn't throw during build or in a
 * not-yet-configured local dev environment. The UI gates real usage on
 * `isConfigured`, so the placeholder client is never actually called.
 */
export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
