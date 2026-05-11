import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, FlipHorizontal2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function WebcamMirror({ className }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(true);

  const startCamera = async () => {
    try {
      setError(null);
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 },
        audio: false,
      });
      streamRef.current = s;

      s.oninactive = () => {
        console.warn("Webcam stream became inactive");
        setActive(false);
      };
      s.getTracks().forEach((t) => {
        t.onended = () => {
          console.warn("Webcam track ended:", t.kind, t.label);
          setActive(false);
        };
      });

      setStream(s);
      setActive(true);
    } catch (err: any) {
      console.error("Webcam error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera in your browser settings."
          : "Could not access camera."
      );
      setActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setActive(false);
  };

  // Attach stream after the <video> element is mounted/visible.
  // Doing this in an effect (instead of inline in startCamera) guarantees the
  // ref is populated by the time we set srcObject and call play().
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active && stream) {
      el.srcObject = stream;
      el.play().catch((e) => {
        console.error("Video play() failed:", e);
        setError("Could not start video playback.");
      });
    } else {
      el.srcObject = null;
    }
  }, [active, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" />
          Mirror Practice
        </p>
        <div className="flex items-center gap-1">
          {active && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => setMirrored(!mirrored)}
              title="Flip camera"
            >
              <FlipHorizontal2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant={active ? "destructive" : "outline"}
            size="sm"
            className="rounded-xl h-7 text-xs gap-1.5"
            onClick={active ? stopCamera : startCamera}
          >
            {active ? (
              <>
                <CameraOff className="w-3 h-3" /> Stop
              </>
            ) : (
              <>
                <Camera className="w-3 h-3" /> Start Camera
              </>
            )}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative rounded-2xl overflow-hidden border-2 transition-all",
          active
            ? "border-emerald-400 dark:border-emerald-600 bg-black"
            : "border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
        )}
        style={{ aspectRatio: "4/3", maxHeight: 200 }}
      >
        {/* Video element is always mounted so the ref is available before
            srcObject is assigned. Visibility is toggled by `active`. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover",
            mirrored && "scale-x-[-1]",
            !active && "hidden"
          )}
        />
        {!active && (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-4">
            <Camera className="w-8 h-8 opacity-30" />
            <p className="text-xs text-center opacity-60">
              Turn on your camera to practice mouth shapes! 📸
            </p>
          </div>
        )}

        {/* Live indicator */}
        {active && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-white font-bold">LIVE</span>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
