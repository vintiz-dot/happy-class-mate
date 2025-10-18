import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SessionGeneratorConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (mode: "future-only" | "include-held") => void;
  month: string;
}

export const SessionGeneratorConfirm = ({
  open,
  onClose,
  onConfirm,
  month,
}: SessionGeneratorConfirmProps) => {
  const [mode, setMode] = useState<"future-only" | "include-held">("future-only");
  const { role } = useAuth();
  const isAdmin = role === "admin";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Sessions for {month}</DialogTitle>
          <DialogDescription>
            Choose how to apply schedule template changes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)}>
            <div className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="future-only" id="future-only" />
              <div className="flex-1">
                <Label htmlFor="future-only" className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold">Future sessions only (Recommended)</span>
                  </div>
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Only create/update/remove future Scheduled sessions. Past Held sessions remain unchanged.
                  Safe for payroll and tuition integrity.
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-start space-x-3 p-3 border border-amber-300 rounded-lg cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/20">
                <RadioGroupItem value="include-held" id="include-held" />
                <div className="flex-1">
                  <Label htmlFor="include-held" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        Also update past Held (Admin only)
                      </span>
                    </div>
                  </Label>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    Allows time edits on past Held sessions for exact-date matches. Status stays Held.
                    ⚠️ Warning: Affects retroactive payroll and tuition calculations.
                  </p>
                </div>
              </div>
            )}
          </RadioGroup>

          {mode === "include-held" && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <p className="font-semibold">Caution: Retroactive Changes</p>
                <p className="mt-1">
                  This will allow time edits on already-held sessions, which may affect historical
                  payroll and tuition records. Use only when correcting data entry errors.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(mode)}>
            Generate Sessions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
