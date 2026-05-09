/**
 * VisemePlayer — Animated Mouth Pronunciation Component
 * ======================================================
 * Renders an SVG-based animated "mouth" that cycles through 21 viseme shapes
 * in sync with audio playback from the Azure TTS edge function.
 *
 * Usage:
 *   <VisemePlayer word="exercise" compact />
 *
 * The component:
 * 1. Calls the `pronounce-viseme` edge function to get audio + viseme timeline
 * 2. Plays the audio via an <audio> element
 * 3. Animates an SVG mouth through the viseme shapes using requestAnimationFrame
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface VisemeFrame {
  id: number;   // 0-21, Azure viseme ID
  offset: number; // milliseconds from audio start
}

interface Props {
  word: string;
  /** Compact mode — just the mouth + play button, no label */
  compact?: boolean;
  className?: string;
}

// ─── 22 Viseme Mouth Shapes (SVG path data) ─────────────────────────────
// These approximate the 22 Azure viseme IDs (0 = silence, 1-21 = phonemes).
// Each is an SVG path for the mouth opening in a 60×40 viewBox.

const VISEME_PATHS: string[] = [
  // 0 — Silence (closed mouth, slight smile)
  "M 10,20 Q 30,22 50,20",
  // 1 — æ, ə, ʌ (medium open, wide)
  "M 8,17 Q 30,32 52,17",
  // 2 — ɑ (wide open)
  "M 8,15 Q 30,36 52,15",
  // 3 — ɔ (rounded open)
  "M 15,16 Q 30,34 45,16",
  // 4 — ɛ, ʊ (half open)
  "M 10,18 Q 30,28 50,18",
  // 5 — ɝ (slightly rounded, medium)
  "M 14,17 Q 30,29 46,17",
  // 6 — j, i, ɪ (wide smile, slightly open)
  "M 6,19 Q 30,24 54,19",
  // 7 — w, u (pursed/rounded)
  "M 20,17 Q 30,28 40,17",
  // 8 — o (rounded, medium open)
  "M 18,16 Q 30,30 42,16",
  // 9 — aʊ (wide to rounded transition)
  "M 12,16 Q 30,33 48,16",
  // 10 — ɔɪ (rounded to spread)
  "M 14,17 Q 30,31 46,17",
  // 11 — aɪ (open to spread)
  "M 10,16 Q 30,32 50,16",
  // 12 — h (relaxed open)
  "M 12,18 Q 30,26 48,18",
  // 13 — ɹ (slightly rounded)
  "M 16,18 Q 30,26 44,18",
  // 14 — l (tongue tip up, narrow open)
  "M 14,19 Q 30,25 46,19",
  // 15 — s, z (teeth close, narrow slit)
  "M 12,20 Q 30,22 48,20",
  // 16 — ʃ, tʃ, dʒ, ʒ (pursed forward)
  "M 18,18 Q 30,26 42,18",
  // 17 — ð (tongue between teeth)
  "M 12,19 Q 30,24 48,19",
  // 18 — f, v (lower lip tucked)
  "M 10,20 Q 30,23 50,20",
  // 19 — d, t, n, θ (tongue tip to ridge)
  "M 12,19 Q 30,24 48,19",
  // 20 — k, g, ŋ (back of mouth, medium open)
  "M 12,17 Q 30,28 48,17",
  // 21 — p, b, m (lips pressed then released)
  "M 14,20 Q 30,20 46,20",
];

// Upper lip (static) and teeth hints
const UPPER_LIP = "M 8,20 Q 20,14 30,13 Q 40,14 52,20";
const TEETH_UPPER = "M 14,20 L 46,20";

export function VisemePlayer({ word, compact, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentViseme, setCurrentViseme] = useState(0);
  const [available, setAvailable] = useState(true); // false if Azure not configured

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visemesRef = useRef<VisemeFrame[]>([]);
  const startTimeRef = useRef(0);
  const rafRef = useRef(0);
  const cachedAudioRef = useRef<{ word: string; url: string; visemes: VisemeFrame[] } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Animation loop: sync viseme to audio time ──
  const animateVisemes = useCallback(() => {
    if (!audioRef.current || audioRef.current.paused) {
      setPlaying(false);
      setCurrentViseme(0);
      return;
    }

    const elapsed = audioRef.current.currentTime * 1000; // Convert to ms
    const visemes = visemesRef.current;

    // Find the current viseme based on elapsed time
    let visemeId = 0;
    for (let i = visemes.length - 1; i >= 0; i--) {
      if (elapsed >= visemes[i].offset) {
        visemeId = visemes[i].id;
        break;
      }
    }

    setCurrentViseme(visemeId);
    rafRef.current = requestAnimationFrame(animateVisemes);
  }, []);

  // ── Play pronunciation with viseme animation ──
  const play = useCallback(async () => {
    if (loading || !word.trim()) return;

    // Check cache first
    if (cachedAudioRef.current?.word === word.trim().toLowerCase()) {
      playFromCache();
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pronounce-viseme", {
        body: { word: word.trim() },
      });

      if (error || data?.error) {
        // Azure not configured — mark unavailable, fall back to browser TTS
        if (data?.fallback || data?.error === "Azure Speech not configured") {
          setAvailable(false);
          fallbackBrowserTTS();
          return;
        }
        console.error("Viseme error:", error || data?.error);
        fallbackBrowserTTS();
        return;
      }

      // Cache the result
      const audioUrl = `data:${data.contentType || "audio/mpeg"};base64,${data.audioBase64}`;
      cachedAudioRef.current = {
        word: word.trim().toLowerCase(),
        url: audioUrl,
        visemes: data.visemes || [],
      };

      playFromCache();
    } catch (err) {
      console.error("Viseme fetch error:", err);
      fallbackBrowserTTS();
    } finally {
      setLoading(false);
    }
  }, [word, loading, animateVisemes]);

  const playFromCache = useCallback(() => {
    if (!cachedAudioRef.current) return;

    const cache = cachedAudioRef.current;
    visemesRef.current = cache.visemes;

    // Create and play audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(cache.url);
    audioRef.current = audio;

    audio.onplay = () => {
      setPlaying(true);
      startTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(animateVisemes);
    };
    audio.onended = () => {
      setPlaying(false);
      setCurrentViseme(0);
      cancelAnimationFrame(rafRef.current);
    };
    audio.onerror = () => {
      setPlaying(false);
      setCurrentViseme(0);
      fallbackBrowserTTS();
    };

    audio.play().catch(() => fallbackBrowserTTS());
  }, [animateVisemes]);

  const fallbackBrowserTTS = useCallback(() => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word.trim());
    u.lang = "en-US";
    u.rate = 0.7;

    // Animate with estimated visemes during browser TTS
    const estimated = estimateVisemesClient(word.trim());
    visemesRef.current = estimated;

    u.onstart = () => {
      setPlaying(true);
      startTimeRef.current = performance.now();
      const animate = () => {
        if (!speechSynthesis.speaking) {
          setPlaying(false);
          setCurrentViseme(0);
          return;
        }
        const elapsed = performance.now() - startTimeRef.current;
        let visemeId = 0;
        for (let i = estimated.length - 1; i >= 0; i--) {
          if (elapsed >= estimated[i].offset) {
            visemeId = estimated[i].id;
            break;
          }
        }
        setCurrentViseme(visemeId);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    };
    u.onend = () => {
      setPlaying(false);
      setCurrentViseme(0);
    };

    speechSynthesis.speak(u);
    setLoading(false);
  }, [word]);

  // ── Render ──
  const mouthPath = VISEME_PATHS[currentViseme] || VISEME_PATHS[0];

  if (compact) {
    return (
      <button
        type="button"
        onClick={play}
        disabled={loading}
        className={cn(
          "group relative inline-flex items-center gap-1.5 rounded-full px-2 py-1",
          "hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors",
          className
        )}
        title="See how to pronounce this word"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
        ) : (
          <>
            {/* Mini mouth SVG */}
            <svg
              viewBox="0 0 60 40"
              className={cn(
                "w-7 h-5 transition-all",
                playing && "scale-110"
              )}
            >
              {/* Face circle */}
              <ellipse
                cx="30" cy="20" rx="28" ry="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-violet-300 dark:text-violet-700"
              />
              {/* Upper lip */}
              <path
                d={UPPER_LIP}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-rose-400"
              />
              {/* Lower lip / mouth opening */}
              <path
                d={mouthPath}
                fill={playing ? "rgba(239,68,68,0.15)" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-rose-400 transition-all duration-75"
              />
              {/* Teeth hint for certain visemes */}
              {(currentViseme === 15 || currentViseme === 17 || currentViseme === 18 || currentViseme === 19) && (
                <path
                  d={TEETH_UPPER}
                  fill="none"
                  stroke="white"
                  strokeWidth="1"
                  opacity="0.7"
                />
              )}
            </svg>
            <Volume2 className="w-3.5 h-3.5 text-violet-500 group-hover:text-violet-700 transition-colors" />
          </>
        )}
      </button>
    );
  }

  // Full-size mode
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <button
        type="button"
        onClick={play}
        disabled={loading}
        className={cn(
          "relative rounded-2xl p-3 border-2 transition-all",
          playing
            ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30 shadow-lg shadow-violet-200/50 dark:shadow-violet-900/30"
            : "border-slate-200 dark:border-slate-700 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-950/20",
        )}
        title="Click to hear pronunciation and see mouth shapes"
      >
        {loading ? (
          <div className="w-20 h-14 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          </div>
        ) : (
          <svg viewBox="0 0 60 40" className="w-20 h-14">
            {/* Face background */}
            <ellipse
              cx="30" cy="20" rx="28" ry="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-slate-200 dark:text-slate-700"
            />
            {/* Eyes */}
            <circle cx="20" cy="12" r="2" fill="currentColor" className="text-slate-400" />
            <circle cx="40" cy="12" r="2" fill="currentColor" className="text-slate-400" />
            {/* Upper lip */}
            <path
              d={UPPER_LIP}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-rose-400"
            />
            {/* Lower lip / mouth opening — animated */}
            <path
              d={mouthPath}
              fill={playing ? "rgba(239,68,68,0.12)" : "none"}
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-rose-400 transition-all duration-75"
            />
            {/* Teeth hint */}
            {(currentViseme === 15 || currentViseme === 17 || currentViseme === 18 || currentViseme === 19) && (
              <path
                d={TEETH_UPPER}
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                opacity="0.6"
              />
            )}
            {/* Tongue hint for L, R, TH visemes */}
            {(currentViseme === 14 || currentViseme === 13 || currentViseme === 17) && (
              <ellipse
                cx="30" cy="24" rx="4" ry="2"
                fill="rgba(244,114,114,0.3)"
              />
            )}
          </svg>
        )}

        {/* Pulse ring when playing */}
        {playing && (
          <div className="absolute inset-0 rounded-2xl border-2 border-violet-400 animate-ping opacity-20" />
        )}
      </button>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Volume2 className="w-3 h-3" />
        <span>{playing ? "Speaking..." : "Tap to pronounce"}</span>
      </div>
    </div>
  );
}

// ─── Client-side viseme estimation (fallback when Azure unavailable) ────

function estimateVisemesClient(word: string): VisemeFrame[] {
  const MAP: Record<string, number> = {
    a: 1, e: 4, i: 6, o: 8, u: 7,
    b: 21, p: 21, m: 21,
    f: 18, v: 18,
    s: 15, z: 15, c: 15,
    t: 19, d: 19, n: 19, l: 14,
    r: 13, k: 20, g: 20,
    w: 7, y: 6, h: 12, q: 20, x: 15,
  };

  const result: VisemeFrame[] = [{ id: 0, offset: 0 }];
  const msPerPhone = 150; // Slow speech ~150ms per phoneme
  let offset = 80;

  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  for (const ch of lower) {
    if (MAP[ch] !== undefined) {
      result.push({ id: MAP[ch], offset });
      offset += msPerPhone;
    }
  }
  result.push({ id: 0, offset: offset + 80 });
  return result;
}
