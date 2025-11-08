import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Archive, Calendar } from "lucide-react";
import { monthKey } from "@/lib/date";

export function LeaderboardResetControl() {
  const [targetMonth, setTargetMonth] = useState(monthKey());
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-monthly-leaderboard", {
        body: { targetMonth },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Archived ${data.archived} records and reset ${data.reset} student scores for ${targetMonth}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Monthly Leaderboard Reset
        </CardTitle>
        <CardDescription>
          Archive current month's scores and start fresh. This preserves historical data in archives.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="target-month" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Target Month (YYYY-MM)
          </Label>
          <Input
            id="target-month"
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            max={monthKey()}
          />
          <p className="text-xs text-muted-foreground">
            Select the month to archive and reset. Current month: {monthKey()}
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={isResetting}>
              {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              Reset Leaderboard for {targetMonth}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive and Reset Leaderboard?</AlertDialogTitle>
              <AlertDialogDescription>
                This will:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Archive all scores for {targetMonth}</li>
                  <li>Reset all student points to 0 for this month</li>
                  <li>Preserve historical data in the archives table</li>
                  <li>Keep point transaction history for audit trail</li>
                </ul>
                <p className="mt-3 font-semibold">This action cannot be undone!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>
                Confirm Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="bg-muted/50 p-3 rounded-lg text-sm">
          <p className="font-medium mb-1">💡 Automation Tip</p>
          <p className="text-muted-foreground">
            You can automate monthly resets using a cron job that calls the reset-monthly-leaderboard function on the 1st of each month.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}