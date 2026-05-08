import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Timer, Disc3, Volume2, Bell, Users } from "lucide-react";
import { VisualTimer } from "./VisualTimer";
import { WheelSpinner } from "./WheelSpinner";
import { NoiseMeter } from "./NoiseMeter";
import { FocusChime } from "./FocusChime";
import { GroupMaker } from "./GroupMaker";
import { cn } from "@/lib/utils";
import { useTimer } from "@/contexts/TimerContext";

const TOOLS = [
  { id: "timer", label: "Timer", icon: Timer },
  { id: "wheel", label: "Spinner", icon: Disc3 },
  { id: "noise", label: "Noise", icon: Volume2 },
  { id: "chime", label: "Chime", icon: Bell },
  { id: "groups", label: "Groups", icon: Users },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

function formatCompact(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Floating launcher mounted into the layout for teachers/admins. Stays
 * visible across pages so a teacher can flip between the lesson view and
 * a tool (timer, spinner, etc.) without navigating away.
 *
 * The Timer state is hoisted into TimerContext so it persists even when
 * the Sheet is closed. All other tools mount lazily.
 */
export function ClassroomToolsLauncher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ToolId>("timer");
  const { running, remaining } = useTimer();

  return (
    <>
      <Button
        type="button"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open Classroom Tools"
        className={cn(
          "fixed bottom-5 right-5 md:bottom-6 md:right-6 z-40 h-14 w-14 rounded-full shadow-q3 lift",
          "bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white",
        )}
      >
        <Sparkles className="h-6 w-6" />

        {/* Running timer indicator badge */}
        {running && (
          <span
            className={cn(
              "absolute -top-1 -right-1 min-w-[2.25rem] px-1.5 py-0.5 rounded-full",
              "bg-emerald-500 text-white text-[10px] font-bold tabular-nums leading-none",
              "shadow-lg animate-pulse pointer-events-none",
            )}
          >
            {formatCompact(remaining)}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col gap-0"
        >
          <SheetHeader className="px-5 py-4 border-b">
            <SheetTitle className="flex items-center gap-2 type-h2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Classroom Tools
            </SheetTitle>
            <SheetDescription className="type-micro">
              Lightweight aids you can pull up mid-lesson without losing your place.
            </SheetDescription>
          </SheetHeader>

          <Tabs
            value={active}
            onValueChange={(v) => setActive(v as ToolId)}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mx-3 mt-3 grid grid-cols-5 h-auto gap-1 bg-muted/60 p-1 rounded-xl shrink-0">
              {TOOLS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="flex flex-col gap-0.5 h-auto py-2 px-1 rounded-lg data-[state=active]:shadow-q1"
                >
                  <t.icon className="h-4 w-4" />
                  <span className="text-[10px] font-semibold">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* Timer is always rendered — state lives in TimerContext
                  so mounting/unmounting is cheap and lossless. */}
              <TabsContent value="timer" className="m-0 focus-visible:outline-none">
                <VisualTimer />
              </TabsContent>
              <TabsContent value="wheel" className="m-0 focus-visible:outline-none">
                {active === "wheel" && <WheelSpinner />}
              </TabsContent>
              <TabsContent value="noise" className="m-0 focus-visible:outline-none">
                {active === "noise" && <NoiseMeter />}
              </TabsContent>
              <TabsContent value="chime" className="m-0 focus-visible:outline-none">
                {active === "chime" && <FocusChime />}
              </TabsContent>
              <TabsContent value="groups" className="m-0 focus-visible:outline-none">
                {active === "groups" && <GroupMaker />}
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
