import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, AlertTriangle } from "lucide-react";

type Status = "idle" | "requesting" | "running" | "denied" | "error";

// Visual zones for the volume meter. Each zone owns a colour, an emoji,
// and a label; the active zone is whichever range the current level falls
// into. Tuned for typical classroom mic input — adjust thresholds if a
// site has noisy ambient baseline.
const ZONES = [
  { from: 0,  to: 22, color: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-300", emoji: "😌", label: "Quiet" },
  { from: 22, to: 45, color: "bg-lime-500",    textColor: "text-lime-700 dark:text-lime-300",       emoji: "🙂", label: "Working" },
  { from: 45, to: 65, color: "bg-amber-500",   textColor: "text-amber-700 dark:text-amber-300",     emoji: "😐", label: "Loud" },
  { from: 65, to: 82, color: "bg-orange-500",  textColor: "text-orange-700 dark:text-orange-300",   emoji: "🙁", label: "Too Loud" },
  { from: 82, to: 101,color: "bg-rose-500",    textColor: "text-rose-700 dark:text-rose-300",       emoji: "😠", label: "Stop!" },
];

function zoneFor(level: number) {
  return ZONES.find((z) => level >= z.from && level < z.to) ?? ZONES[ZONES.length - 1];
}

export function NoiseMeter() {
  const [status, setStatus] = useState<Status>("idle");
  const [level, setLevel] = useState(0); // 0–100
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    analyserRef.current = null;
    setStatus("idle");
    setLevel(0);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setError(null);
    setStatus("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone API not available in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error("AudioContext unavailable.");
      const ctx = new Ctor();
      ctxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.fftSize);
      let smoothed = 0;

      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        // RMS over the time-domain buffer. Bytes are 0–255 centred at 128.
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / buffer.length); // 0–1
        // Map to 0–100. Multiply because typical speech RMS is well under 0.4.
        const raw = Math.min(100, rms * 220);
        smoothed = smoothed * 0.7 + raw * 0.3;
        setLevel(Math.round(smoothed));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setStatus("running");
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (e?.name === "NotAllowedError" || msg.includes("Permission")) {
        setStatus("denied");
        setError("Microphone permission was denied. Allow it in your browser settings to use the meter.");
      } else if (e?.name === "NotFoundError") {
        setStatus("error");
        setError("No microphone detected.");
      } else {
        setStatus("error");
        setError(msg);
      }
    }
  };

  const zone = zoneFor(level);

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="type-h1">Noise Meter</h3>
        <p className="type-micro text-muted-foreground">
          Live volume from your device's microphone. Tap stop to release the mic.
        </p>
      </div>

      {/* Big emoji + zone label */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-7xl leading-none select-none" aria-hidden>
          {status === "running" ? zone.emoji : "🎤"}
        </span>
        <span className={`type-h2 ${status === "running" ? zone.textColor : "text-muted-foreground"}`}>
          {status === "running" ? zone.label : "Ready"}
        </span>
      </div>

      {/* Vertical bar with zone bands */}
      <div className="flex items-end justify-center gap-3">
        <div className="relative h-48 w-16 rounded-2xl bg-muted overflow-hidden ring-1 ring-border">
          {/* Zone bands as background. */}
          <div className="absolute inset-x-0 bottom-0 h-[22%] bg-emerald-500/15" />
          <div className="absolute inset-x-0 bottom-[22%] h-[23%] bg-lime-500/15" />
          <div className="absolute inset-x-0 bottom-[45%] h-[20%] bg-amber-500/15" />
          <div className="absolute inset-x-0 bottom-[65%] h-[17%] bg-orange-500/15" />
          <div className="absolute inset-x-0 bottom-[82%] h-[18%] bg-rose-500/15" />
          {/* Live fill */}
          <div
            className={`absolute inset-x-0 bottom-0 transition-[height,background-color] duration-100 ${zone.color}`}
            style={{ height: `${level}%` }}
          />
        </div>
        <div className="flex flex-col items-start type-micro text-muted-foreground tabular-nums">
          <span className="text-foreground type-h1 tabular-nums">{level}</span>
          <span>/ 100</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {status === "running" ? (
          <Button onClick={stop} variant="secondary" size="lg" className="gap-2 h-12 px-6">
            <MicOff className="h-4 w-4" />
            Stop
          </Button>
        ) : (
          <Button
            onClick={start}
            disabled={status === "requesting"}
            size="lg"
            className="gap-2 h-12 px-6"
          >
            <Mic className="h-4 w-4" />
            {status === "requesting" ? "Requesting…" : "Start listening"}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="type-micro text-amber-800 dark:text-amber-200">{error}</p>
        </div>
      )}

      <div className="rounded-xl bg-muted/40 p-3 type-micro text-muted-foreground">
        The meter uses your browser microphone only — no recording is stored or sent anywhere.
      </div>
    </div>
  );
}
