import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw } from "lucide-react";
import { playChime } from "./audio";

const PRESETS = [
  { label: "1m", seconds: 60 },
  { label: "3m", seconds: 180 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
  { label: "15m", seconds: 900 },
];

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function VisualTimer() {
  const [totalSeconds, setTotalSeconds] = useState(300);
  const [remaining, setRemaining] = useState(300);
  const [running, setRunning] = useState(false);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [draftMin, setDraftMin] = useState("5");
  const [draftSec, setDraftSec] = useState("0");

  // Tick. We compute remaining off a wall-clock target so it stays
  // accurate even if the tab throttles.
  useEffect(() => {
    if (!running || endedAt === null) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    const tick = () => {
      const now = performance.now();
      const r = Math.max(0, Math.round((endedAt - now) / 1000));
      setRemaining(r);
      if (r <= 0) {
        setRunning(false);
        playChime();
      }
    };
    tick();
    intervalRef.current = window.setInterval(tick, 200) as unknown as number;
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, endedAt]);

  const start = (seconds?: number) => {
    const target = seconds ?? totalSeconds;
    if (target <= 0) return;
    setTotalSeconds(target);
    setRemaining(target);
    setEndedAt(performance.now() + target * 1000);
    setRunning(true);
  };

  const pause = () => {
    setRunning(false);
    // Convert remaining time to a fresh endedAt the moment we resume.
  };

  const resume = () => {
    setEndedAt(performance.now() + remaining * 1000);
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setRemaining(totalSeconds);
    setEndedAt(null);
  };

  const applyDraft = () => {
    const m = Math.max(0, Math.min(99, Number(draftMin) || 0));
    const s = Math.max(0, Math.min(59, Number(draftSec) || 0));
    const total = m * 60 + s;
    if (total === 0) return;
    setTotalSeconds(total);
    setRemaining(total);
    setRunning(false);
    setEndedAt(null);
  };

  const progress = useMemo(() => {
    if (totalSeconds === 0) return 0;
    return remaining / totalSeconds;
  }, [remaining, totalSeconds]);

  // Color stops: green > 50%, amber 20–50%, red < 20%, soft red flash at 0.
  const ringColor =
    progress > 0.5
      ? "stroke-emerald-500"
      : progress > 0.2
      ? "stroke-amber-500"
      : "stroke-rose-500";

  // SVG ring math.
  const RADIUS = 86;
  const CIRC = 2 * Math.PI * RADIUS;
  const dash = CIRC * progress;

  const isFinished = running === false && remaining === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center">
        <div className="relative">
          <svg width="220" height="220" viewBox="0 0 220 220" className="-rotate-90">
            <circle
              cx="110"
              cy="110"
              r={RADIUS}
              className="stroke-muted"
              strokeWidth="14"
              fill="none"
            />
            <circle
              cx="110"
              cy="110"
              r={RADIUS}
              className={`${ringColor} transition-[stroke,stroke-dashoffset] duration-500`}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC - dash}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className={`type-display tabular-nums ${isFinished ? "text-rose-600 animate-pulse" : "text-foreground"}`}
            >
              {formatTime(remaining)}
            </span>
            <span className="type-micro text-muted-foreground">
              {isFinished ? "Time's up!" : running ? "running" : "paused"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {!running && remaining === totalSeconds && (
          <Button onClick={() => start()} size="lg" className="gap-2 h-12 px-6">
            <Play className="h-4 w-4" />
            Start
          </Button>
        )}
        {!running && remaining < totalSeconds && remaining > 0 && (
          <Button onClick={resume} size="lg" className="gap-2 h-12 px-6">
            <Play className="h-4 w-4" />
            Resume
          </Button>
        )}
        {running && (
          <Button onClick={pause} size="lg" variant="secondary" className="gap-2 h-12 px-6">
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        )}
        <Button
          onClick={reset}
          size="lg"
          variant="outline"
          className="gap-2 h-12 px-4"
          disabled={remaining === totalSeconds && !running}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            className="h-10 font-semibold"
            onClick={() => start(p.seconds)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label htmlFor="vt-min" className="type-micro">Minutes</Label>
          <Input
            id="vt-min"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={draftMin}
            onChange={(e) => setDraftMin(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vt-sec" className="type-micro">Seconds</Label>
          <Input
            id="vt-sec"
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={draftSec}
            onChange={(e) => setDraftSec(e.target.value)}
          />
        </div>
        <Button onClick={applyDraft} variant="secondary" className="h-10">
          Set
        </Button>
      </div>
    </div>
  );
}
