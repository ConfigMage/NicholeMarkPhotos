"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { thumbUrl } from "@/lib/storage";
import type { UploadRow } from "@/lib/types";
import Lightbox from "./Lightbox";

const PAGE_SIZE = 24;

export default function Gallery() {
  const [items, setItems] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Keep a stable reference to the oldest loaded row for keyset pagination,
  // so live inserts at the top never shift the "load more" window.
  const oldestRef = useRef<string | null>(null);

  const upsertMany = useCallback((rows: UploadRow[], position: "end" | "start") => {
    setItems((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      const fresh = rows.filter((r) => !seen.has(r.id));
      if (fresh.length === 0) return prev;
      return position === "start" ? [...fresh, ...prev] : [...prev, ...fresh];
    });
  }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    let query = supabase
      .from("uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (oldestRef.current) {
      query = query.lt("created_at", oldestRef.current);
    }

    const { data, error } = await query;
    if (!error && data) {
      const rows = data as UploadRow[];
      if (rows.length > 0) {
        oldestRef.current = rows[rows.length - 1].created_at;
        upsertMany(rows, "end");
      }
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [upsertMany]);

  // Initial load.
  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: prepend new uploads as they arrive.
  useEffect(() => {
    const channel = supabase
      .channel("uploads-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "uploads" },
        (payload) => {
          upsertMany([payload.new as UploadRow], "start");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [upsertMany]);

  const openAt = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  return (
    <section className="mt-14">
      <div className="mb-5 flex items-center justify-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-sage" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
        </span>
        <h2 className="font-serif text-2xl text-charcoal">Live Gallery</h2>
      </div>

      {loading ? (
        <GallerySkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="masonry columns-2 sm:columns-3 lg:columns-4">
            {items.map((item, i) => (
              <Tile key={item.id} item={item} onClick={() => openAt(i)} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-full border border-rose/50 bg-surface px-7 py-2.5 text-sm font-medium text-rose-deep shadow-tile transition-colors hover:bg-blush/40 disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={setLightboxIndex}
        />
      )}
    </section>
  );
}

function Tile({
  item,
  onClick,
}: {
  item: UploadRow;
  onClick: () => void;
}) {
  const isVideo = item.media_type === "video";
  const thumbSource = isVideo ? item.poster_path : item.storage_path;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl2 border border-blush bg-surface shadow-tile transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-soft animate-fade-in"
    >
      <div className="relative">
        {thumbSource ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(thumbSource)}
            alt={
              item.uploader_name
                ? `Shared by ${item.uploader_name}`
                : "Wedding moment"
            }
            loading="lazy"
            className="w-full object-cover"
          />
        ) : (
          // Video with no usable poster: tasteful placeholder tile.
          <div className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-pale-sage to-blush">
            <PlayBadge />
          </div>
        )}

        {isVideo && thumbSource && (
          <span className="absolute inset-0 flex items-center justify-center">
            <PlayBadge />
          </span>
        )}

        {item.uploader_name && (
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-charcoal/55 to-transparent px-2.5 pb-1.5 pt-6 text-left text-xs font-medium text-cream">
            {item.uploader_name}
          </span>
        )}
      </div>
    </button>
  );
}

function PlayBadge() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/85 shadow-soft">
      <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-rose-deep">
        <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
      </svg>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md rounded-xl2 border border-dashed border-sage/50 bg-pale-sage/30 px-6 py-12 text-center">
      <p className="font-serif text-xl text-charcoal">No photos just yet</p>
      <p className="mt-2 text-sm text-warm-gray">
        Be the first to share a moment — your upload will appear here live. 💛
      </p>
    </div>
  );
}

function GallerySkeleton() {
  const heights = ["h-40", "h-52", "h-44", "h-60", "h-48", "h-56", "h-40", "h-52"];
  return (
    <div className="masonry columns-2 sm:columns-3 lg:columns-4">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`mb-3 ${h} w-full break-inside-avoid animate-pulse-soft rounded-xl2 bg-blush/50`}
        />
      ))}
    </div>
  );
}
