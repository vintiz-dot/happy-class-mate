/**
 * ImageCarousel — horizontally-scrolling, lazy-loaded image strip for a
 * vocabulary word. Aggregates results from every configured image provider
 * (Pixabay, Pexels, Wikimedia, Google CSE, Unsplash) and de-dupes by URL
 * server-side. Each thumbnail uses native loading="lazy" + async decoding
 * + a width/height hint so the carousel paints instantly without layout
 * shift, and only fetches images that scroll into view.
 *
 * Optional onPick callback lets parents (e.g. WordExplorer's Save flow)
 * capture which image the student associates with their saved entry.
 */

import { useState, useEffect } from "react";
import { Loader2, ImageOff, Check } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface ImageItem {
  url: string;
  thumb: string;
  thumbnail: string; // back-compat alias
  alt: string;
  source: "pixabay" | "pexels" | "wikimedia" | "google" | "unsplash" | string;
}

interface Props {
  query: string;
  className?: string;
  /** Currently picked image URL. Highlights the matching tile. */
  pickedUrl?: string;
  /** Fired when a tile is clicked. If absent, tiles are not clickable. */
  onPick?: (img: ImageItem) => void;
}

const SOURCE_BADGE: Record<string, { label: string; bg: string }> = {
  pixabay:   { label: "Pixabay",   bg: "bg-green-500/85" },
  pexels:    { label: "Pexels",    bg: "bg-teal-500/85" },
  wikimedia: { label: "Wiki",      bg: "bg-slate-700/85" },
  google:    { label: "Google",    bg: "bg-blue-500/85" },
  unsplash:  { label: "Unsplash",  bg: "bg-zinc-800/85" },
};

export function ImageCarousel({ query, className, pickedUrl, onPick }: Props) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setImages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setImages([]);
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "image-search",
          { body: { query: query.trim(), count: 4 } },
        );
        if (cancelled) return;
        if (fnErr) {
          console.error("Image search error:", fnErr);
          setError("Could not load images");
          return;
        }
        setImages(Array.isArray(data?.images) ? data.images : []);
      } catch (err) {
        if (!cancelled) {
          console.error("Image fetch error:", err);
          setError("Could not load images");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Finding pictures...
        </p>
        <div className="flex overflow-hidden gap-3 p-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-[140px] h-[105px] rounded-xl shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center py-6 text-muted-foreground gap-2", className)}>
        <ImageOff className="w-5 h-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (images.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        🖼️ Pictures for this word
        {onPick && <span className="ml-2 normal-case font-medium text-muted-foreground">— tap one to pick</span>}
      </p>
      <ScrollArea className="w-full whitespace-nowrap rounded-xl">
        <div className="flex w-max gap-3 p-1">
          {images.map((img, i) => {
            const picked = pickedUrl && img.url === pickedUrl;
            const badge = SOURCE_BADGE[img.source] ?? { label: img.source, bg: "bg-slate-500/85" };
            const isClickable = !!onPick;
            const Wrapper: any = isClickable ? "button" : "div";
            return (
              <Wrapper
                key={`${img.url}-${i}`}
                {...(isClickable
                  ? { type: "button", onClick: () => onPick!(img), "aria-pressed": picked }
                  : {})}
                className={cn(
                  "relative rounded-xl overflow-hidden w-[140px] h-[105px] shrink-0 shadow-sm border-2 transition-all",
                  isClickable && "cursor-pointer hover:scale-[1.02]",
                  picked
                    ? "border-violet-500 ring-2 ring-violet-300"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-400",
                )}
              >
                <img
                  src={img.thumb || img.thumbnail || img.url}
                  alt={img.alt}
                  width={140}
                  height={105}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onError={(e) => {
                    // Swap to the larger url if thumb 404s, then hide on second failure.
                    const el = e.currentTarget;
                    if (el.dataset.fallback !== "1" && img.url && el.src !== img.url) {
                      el.dataset.fallback = "1";
                      el.src = img.url;
                    } else {
                      el.style.visibility = "hidden";
                    }
                  }}
                />
                <div className="absolute top-1.5 right-1.5">
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-sm backdrop-blur-md text-white shadow-sm uppercase tracking-wider",
                      badge.bg,
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
                {picked && (
                  <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                    <div className="bg-violet-600 text-white rounded-full p-1 shadow-lg">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                )}
              </Wrapper>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

/** Lightweight helper used by other components (e.g. legacy sandbox). */
export async function fetchImagesForWord(query: string, count = 4): Promise<ImageItem[]> {
  try {
    const { data, error } = await supabase.functions.invoke("image-search", {
      body: { query: query.trim(), count },
    });
    if (error || !data?.images) return [];
    return data.images;
  } catch {
    return [];
  }
}
