import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, History, Coins, Banknote } from "lucide-react";
import { WithdrawModal } from "./WithdrawModal";
import { DepositModal } from "./DepositModal";
import { StudentLedger } from "./StudentLedger";
import { motion } from "framer-motion";

interface StudentWalletProps {
  studentId: string;
  classId: string;
  className: string;
  totalPoints: number;
  economyMode: boolean;
  pointsToCashRate: number;
}

export function StudentWallet({ studentId, classId, className, totalPoints, economyMode, pointsToCashRate }: StudentWalletProps) {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const queryClient = useQueryClient();

  const { data: cashOnHand = 0 } = useQuery({
    queryKey: ["student-cash", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("cash_on_hand")
        .eq("id", studentId)
        .single();
      return data?.cash_on_hand || 0;
    },
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["student-pending-tx", studentId, classId],
    queryFn: async () => {
      const { count } = await supabase
        .from("economy_transactions")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .eq("status", "pending");
      return count || 0;
    },
  });

  if (!economyMode) return null;

  const potentialCash = Math.floor(totalPoints / pointsToCashRate);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
      >
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wallet className="h-5 w-5 text-primary" />
              My Bank — {className}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Balance Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-sm rounded-xl p-3 text-center">
                <Coins className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-black text-primary">{totalPoints}</p>
                <p className="text-xs text-muted-foreground">Points</p>
              </div>
              <div className="glass-sm rounded-xl p-3 text-center">
                <Banknote className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-black text-green-600">{cashOnHand}</p>
                <p className="text-xs text-muted-foreground">Cash on Hand</p>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Rate: {pointsToCashRate} pts = 1 cash unit
              {potentialCash > 0 && ` • You can withdraw up to ${potentialCash} cash`}
            </p>

            {pendingCount > 0 && (
              <Badge variant="secondary" className="w-full justify-center">
                {pendingCount} pending request{pendingCount > 1 ? "s" : ""}
              </Badge>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowWithdraw(true)}
                disabled={potentialCash < 1}
                className="gap-1"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                <span className="text-xs">Withdraw</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeposit(true)}
                className="gap-1"
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                <span className="text-xs">Deposit</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLedger(true)}
                className="gap-1"
              >
                <History className="h-3.5 w-3.5" />
                <span className="text-xs">History</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <WithdrawModal
        open={showWithdraw}
        onOpenChange={setShowWithdraw}
        studentId={studentId}
        classId={classId}
        totalPoints={totalPoints}
        pointsToCashRate={pointsToCashRate}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["student-cash", studentId] });
          queryClient.invalidateQueries({ queryKey: ["student-pending-tx", studentId] });
          queryClient.invalidateQueries({ queryKey: ["student-total-points", studentId] });
        }}
      />

      <DepositModal
        open={showDeposit}
        onOpenChange={setShowDeposit}
        studentId={studentId}
        classId={classId}
        cashOnHand={cashOnHand}
        pointsToCashRate={pointsToCashRate}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["student-cash", studentId] });
          queryClient.invalidateQueries({ queryKey: ["student-pending-tx", studentId] });
        }}
      />

      <StudentLedger
        open={showLedger}
        onOpenChange={setShowLedger}
        studentId={studentId}
        classId={classId}
      />
    </>
  );
}
