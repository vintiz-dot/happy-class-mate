/**
 * image-search Edge Function
 * ============================
 * Proxies image search requests to Pixabay (primary) with Pexels fallback.
 * Appends "isolated white background" to queries for kid-friendly clarity.
 *
 * Input:  { query: string, count?: number }
 * Output: { images: { url: string, thumbnail: string, alt: string, source: string }[] }
 *
 * Secrets required:
 *   Pixabay_API — Pixabay API key
 *   Pexels_API  — Pexels API key
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ImageResult {
  url: string;
  thumbnail: string;
  alt: string;
  source: "pixabay" | "pexels";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const rawQuery = (body.query || "").trim();
    const count = Math.min(Math.max(body.count || 8, 1), 20);
    const provider = body.provider; // "pixabay" | "pexels" | undefined

    if (!rawQuery) {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Kid-friendly illustration query — Pixabay primary, Pexels fallback
    const pixabayQuery = `${rawQuery} simple illustration isolated`;
    const pexelsQuery = `${rawQuery} simple illustration isolated kid friendly clear`;

    // ── Try Pixabay first (unless provider is strictly pexels) ──
    const pixabayKey = Deno.env.get("Pixabay_API");
    const pexelsKey = Deno.env.get("Pexels_API");

    // The user requested 6 images from each API.
    // We will ask for 6 from both to ensure we get a mixed batch of 12 total.
    const perPage = 6;

    const fetchPixabay = async (): Promise<ImageResult[]> => {
      if (!pixabayKey || provider === "pexels") return [];
      try {
        const pixabayUrl =
          `https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey)}` +
          `&q=${encodeURIComponent(pixabayQuery)}` +
          `&image_type=illustration&safesearch=true&per_page=${perPage}&lang=en`;

        const res = await fetch(pixabayUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.hits) {
            return data.hits.map((hit: any) => ({
              url: hit.webformatURL || hit.largeImageURL,
              thumbnail: hit.previewURL || hit.webformatURL,
              alt: hit.tags || rawQuery,
              source: "pixabay",
            }));
          }
        }
      } catch (e) {
        console.error("Pixabay search failed:", e);
      }
      return [];
    };

    const fetchPexels = async (): Promise<ImageResult[]> => {
      if (!pexelsKey || provider === "pixabay") return [];
      try {
        const pexelsUrl =
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(pexelsQuery)}` +
          `&per_page=${perPage}&size=small`;

        const res = await fetch(pexelsUrl, {
          headers: { Authorization: pexelsKey },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.photos) {
            return data.photos.map((photo: any) => ({
              url: photo.src?.medium || photo.src?.original,
              thumbnail: photo.src?.small || photo.src?.tiny,
              alt: photo.alt || rawQuery,
              source: "pexels",
            }));
          }
        }
      } catch (e) {
        console.error("Pexels search failed:", e);
      }
      return [];
    };

    const [pixabayResults, pexelsResults] = await Promise.all([
      fetchPixabay(),
      fetchPexels()
    ]);

    // Interleave the results so the user gets a nice mix
    const combinedImages: ImageResult[] = [];
    const maxLength = Math.max(pixabayResults.length, pexelsResults.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < pixabayResults.length) combinedImages.push(pixabayResults[i]);
      if (i < pexelsResults.length) combinedImages.push(pexelsResults[i]);
    }

    if (combinedImages.length === 0) {
      return new Response(
        JSON.stringify({ images: [], source: "none", message: "No images found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ images: combinedImages, source: provider || "mixed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("image-search error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
