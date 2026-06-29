"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MAX_BYTES,
  buildObjectName,
  detectMediaType,
  formatBytes,
  generatePoster,
  insertUploadRow,
  maybeConvertHeic,
  tusUpload,
  uploadPoster,
} from "@/lib/upload";
import type { MediaType } from "@/lib/types";

type Status = "queued" | "converting" | "uploading" | "done" | "error";

interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mediaType: MediaType;
  status: Status;
  progress: number;
  error?: string;
}

const NAME_KEY = "wedding_uploader_name";
const CONCURRENCY = 3;

export default function UploadSection() {
  const [uploaderName, setUploaderName] = useState("");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the latest name available inside async workers without re-creating them.
  const nameRef = useRef("");
  useEffect(() => {
    nameRef.current = uploaderName.trim();
  }, [uploaderName]);

  // Restore a previously entered name.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setUploaderName(saved);
    } catch {
      /* ignore private-mode storage errors */
    }
  }, []);

  const onNameChange = (value: string) => {
    setUploaderName(value);
    try {
      localStorage.setItem(NAME_KEY, value.trim());
    } catch {
      /* ignore */
    }
  };

  const patchItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }, []);

  /** Full per-file pipeline: convert -> upload -> poster -> insert row. */
  const processItem = useCallback(
    async (item: QueueItem) => {
      try {
        let file = item.file;

        // 1. HEIC/HEIF -> JPEG so the gallery can render it.
        if (item.mediaType === "image") {
          patchItem(item.id, { status: "converting" });
          file = await maybeConvertHeic(item.file);
        }

        const objectName = buildObjectName(file.name);
        const contentType = file.type || "application/octet-stream";

        // 2. Resumable upload of the main file (browser -> Supabase, never Vercel).
        patchItem(item.id, { status: "uploading", progress: 0 });
        await tusUpload(file, objectName, contentType, (percent) =>
          patchItem(item.id, { progress: percent }),
        );

        // 3. Best-effort video poster. Failure is fine — we fall back to a play tile.
        let posterPath: string | null = null;
        if (item.mediaType === "video") {
          const poster = await generatePoster(item.file);
          if (poster) {
            const candidate = `${objectName}.poster.jpg`;
            try {
              await uploadPoster(candidate, poster);
              posterPath = candidate;
            } catch {
              posterPath = null;
            }
          }
        }

        // 4. Metadata row -> appears in the live gallery via Realtime.
        await insertUploadRow({
          storage_path: objectName,
          uploader_name: nameRef.current || null,
          media_type: item.mediaType,
          poster_path: posterPath,
        });

        patchItem(item.id, { status: "done", progress: 100 });
      } catch (err) {
        patchItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [patchItem],
  );

  /** Simple concurrency-limited pool so weak venue wifi isn't overwhelmed. */
  const runPool = useCallback(
    async (queue: QueueItem[]) => {
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, queue.length) },
        async () => {
          while (cursor < queue.length) {
            const current = queue[cursor++];
            await processItem(current);
          }
        },
      );
      await Promise.all(workers);
    },
    [processItem],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const accepted: QueueItem[] = [];
      const rejected: QueueItem[] = [];

      for (const file of files) {
        const base: QueueItem = {
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: file.size,
          mediaType: detectMediaType(file),
          status: "queued",
          progress: 0,
        };
        if (file.size > MAX_BYTES) {
          rejected.push({
            ...base,
            status: "error",
            error: `Too large (${formatBytes(file.size)}). Max is 500 MB.`,
          });
        } else {
          accepted.push(base);
        }
      }

      setItems((prev) => [...rejected, ...accepted, ...prev]);
      if (accepted.length > 0) {
        // Fire-and-forget; each item updates its own state.
        void runPool(accepted);
      }
    },
    [runPool],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    // Reset so picking the same file again re-triggers change.
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const clearFinished = () =>
    setItems((prev) => prev.filter((it) => it.status !== "done"));

  // ---- Derived progress / counts ----
  const stats = useMemo(() => {
    const active = items.filter(
      (it) => it.status === "uploading" || it.status === "converting",
    );
    const done = items.filter((it) => it.status === "done").length;
    const errored = items.filter((it) => it.status === "error").length;
    const total = items.length;
    const overall =
      total === 0
        ? 0
        : Math.round(
            items.reduce(
              (sum, it) => sum + (it.status === "done" ? 100 : it.progress),
              0,
            ) / total,
          );
    return { active: active.length, done, errored, total, overall };
  }, [items]);

  const isBusy = stats.active > 0;
  const allDone =
    stats.total > 0 && stats.done + stats.errored === stats.total;

  return (
    <section className="mt-2">
      {/* Name input */}
      <div className="mx-auto max-w-md">
        <label
          htmlFor="uploader-name"
          className="mb-1.5 block text-center text-xs font-medium uppercase tracking-wide text-warm-gray"
        >
          Your first name{" "}
          <span className="font-normal lowercase tracking-normal text-warm-gray/70">
            (optional)
          </span>
        </label>
        <input
          id="uploader-name"
          type="text"
          inputMode="text"
          autoComplete="given-name"
          placeholder="So we know who to thank"
          value={uploaderName}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={40}
          className="w-full rounded-full border border-blush bg-surface px-5 py-3 text-center text-charcoal placeholder:text-warm-gray/60 focus:border-rose focus:ring-2 focus:ring-rose/30"
        />
      </div>

      {/* Drop zone / picker */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`mx-auto mt-5 max-w-xl rounded-xl2 border-2 border-dashed p-7 text-center transition-colors ${
          isDragging
            ? "border-rose bg-blush/50"
            : "border-rose/40 bg-pale-sage/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={onInputChange}
          className="hidden"
        />

        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-tile">
          <CameraIcon className="h-6 w-6 text-rose-deep" />
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-full bg-rose px-7 py-3 font-medium text-white shadow-soft transition-colors hover:bg-rose-deep active:bg-rose-deep"
        >
          Add photos &amp; videos
        </button>

        <p className="mt-3 text-xs text-warm-gray">
          Pick as many as you like — they upload right here. Up to 500 MB each.
        </p>
      </div>

      {/* Overall progress + queue */}
      {items.length > 0 && (
        <div className="mx-auto mt-6 max-w-xl rounded-xl2 border border-blush bg-surface p-5 shadow-tile">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-charcoal">
              {allDone ? (
                <span className="text-sage-deep">
                  All set — thank you! 💛
                </span>
              ) : isBusy ? (
                "Uploading…"
              ) : (
                "Ready"
              )}
            </p>
            <p className="text-xs text-warm-gray">
              {stats.done}/{stats.total} done
              {stats.errored > 0 && ` · ${stats.errored} failed`}
            </p>
          </div>

          {/* Overall bar (sage) */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-pale-sage">
            <div
              className="h-full rounded-full bg-sage transition-[width] duration-300 ease-out"
              style={{ width: `${stats.overall}%` }}
            />
          </div>

          {/* Per-file list */}
          <ul className="mt-4 space-y-3">
            {items.map((it) => (
              <li key={it.id} className="text-left">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    {it.mediaType === "video" ? (
                      <VideoIcon className="h-4 w-4 shrink-0 text-warm-gray" />
                    ) : (
                      <PhotoIcon className="h-4 w-4 shrink-0 text-warm-gray" />
                    )}
                    <span className="truncate text-sm text-charcoal">
                      {it.name}
                    </span>
                  </span>
                  <StatusLabel item={it} />
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                      it.status === "error"
                        ? "bg-rose-deep/40"
                        : it.status === "done"
                          ? "bg-sage"
                          : "bg-sage/80"
                    }`}
                    style={{
                      width: `${it.status === "done" ? 100 : it.progress}%`,
                    }}
                  />
                </div>
                {it.error && (
                  <p className="mt-1 text-xs text-rose-deep">{it.error}</p>
                )}
              </li>
            ))}
          </ul>

          {allDone && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={clearFinished}
                className="text-xs font-medium text-rose-deep underline-offset-2 hover:underline"
              >
                Clear list
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatusLabel({ item }: { item: QueueItem }) {
  if (item.status === "done")
    return <span className="text-xs font-medium text-sage-deep">Done</span>;
  if (item.status === "error")
    return <span className="text-xs font-medium text-rose-deep">Failed</span>;
  if (item.status === "converting")
    return <span className="text-xs text-warm-gray">Converting…</span>;
  if (item.status === "uploading")
    return (
      <span className="text-xs tabular-nums text-warm-gray">
        {item.progress}%
      </span>
    );
  return <span className="text-xs text-warm-gray">Queued</span>;
}

/* ---- Inline icons (keep the bundle tiny, no icon dependency) ---- */

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 9.3 3.7h5.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      <circle cx="12" cy="12.5" r="3.3" />
    </svg>
  );
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L20 21" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="m16 10 5-2.5v9L16 14" />
    </svg>
  );
}
