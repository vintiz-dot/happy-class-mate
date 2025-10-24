import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface CorruptedContribution {
  tx_id: string;
  student_id: string;
  amount: number;
  month: string;
  occurred_at: string;
  payment_method: string;
}

export function VoluntaryContributionRepair() {
  const [scanning, setScanning] = useState(false);
  const [issues, setIssues] = useState<CorruptedContribution[]>([]);
  const queryClient = useQueryClient();

  const scanForCorruptedContributions = async () => {
    setScanning(true);
    setIssues([]);
    
    try {
      // Find ledger entries where voluntary contributions incorrectly touched AR
      // Look for tx_key containing 'contribution' with AR account
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('ledger_entries')
        .select(`
          tx_id,
          tx_key,
          debit,
          credit,
          occurred_at,
          month,
          memo,
          ledger_accounts!inner(student_id, code)
        `)
        .ilike('tx_key', '%contribution%')
        .eq('ledger_accounts.code', 'AR');

      if (ledgerError) throw ledgerError;

      const corrupted: CorruptedContribution[] = [];
      
      // Group by tx_id to find the amount and student
      const txGroups = new Map<string, any[]>();
      for (const entry of ledgerData || []) {
        const txId = entry.tx_id;
        if (!txGroups.has(txId)) txGroups.set(txId, []);
        txGroups.get(txId)!.push(entry);
      }

      for (const [txId, entries] of txGroups) {
        const arEntry = entries.find(e => (e.ledger_accounts as any).code === 'AR');
        if (!arEntry) continue;

        const amount = arEntry.debit || arEntry.credit;
        const studentId = (arEntry.ledger_accounts as any).student_id;
        
        // Determine payment method from memo or assume cash
        const paymentMethod = arEntry.memo?.toLowerCase().includes('bank') ? 'bank' : 'cash';

        corrupted.push({
          tx_id: txId,
          student_id: studentId,
          amount,
          month: arEntry.month,
          occurred_at: arEntry.occurred_at,
          payment_method: paymentMethod
        });
      }

      setIssues(corrupted);
      
      if (corrupted.length === 0) {
        toast.success("No corrupted voluntary contributions found");
      } else {
        toast.warning(`Found ${corrupted.length} corrupted contribution(s)`);
      }
    } catch (error: any) {
      toast.error("Failed to scan: " + error.message);
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  const repairMutation = useMutation({
    mutationFn: async () => {
      for (const issue of issues) {
        // 1. Delete the incorrect AR entries
        const { error: deleteError } = await supabase
          .from('ledger_entries')
          .delete()
          .eq('tx_id', issue.tx_id);

        if (deleteError) throw deleteError;

        // 2. Get account IDs for this student
        const { data: accounts } = await supabase
          .from('ledger_accounts')
          .select('id, code')
          .eq('student_id', issue.student_id);

        const accountMap = new Map(accounts?.map(a => [a.code, a.id]));

        // 3. Post correct entries: CASH/BANK -> REVENUE (no AR)
        const newTxId = crypto.randomUUID();
        const { error: insertError } = await supabase
          .from('ledger_entries')
          .insert([
            {
              tx_id: newTxId,
              tx_key: `repaired-contribution-${issue.tx_id}`,
              account_id: issue.payment_method === 'cash' ? accountMap.get('CASH') : accountMap.get('BANK'),
              debit: 0,
              credit: issue.amount,
              occurred_at: issue.occurred_at,
              memo: `Repaired: Voluntary contribution (direct to revenue)`,
              month: issue.month,
            },
            {
              tx_id: newTxId,
              account_id: accountMap.get('REVENUE'),
              debit: issue.amount,
              credit: 0,
              occurred_at: issue.occurred_at,
              memo: `Repaired: Voluntary contribution - no AR impact`,
              month: issue.month,
            }
          ]);

        if (insertError) throw insertError;

        // 4. Log repair to audit
        await supabase.from('audit_log').insert({
          entity: 'ledger_entries',
          action: 'repair_contribution',
          entity_id: issue.tx_id,
          diff: {
            student_id: issue.student_id,
            amount: issue.amount,
            month: issue.month,
            old_tx_id: issue.tx_id,
            new_tx_id: newTxId,
            reason: 'Corrected voluntary contribution to bypass AR'
          }
        });

        // 5. Recalculate tuition for affected student
        await supabase.functions.invoke('calculate-tuition', {
          body: { studentId: issue.student_id, month: issue.month }
        });
      }
    },
    onSuccess: () => {
      toast.success(`Repaired ${issues.length} voluntary contribution(s)`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['student-tuition'] });
      setIssues([]);
    },
    onError: (error: any) => {
      toast.error("Repair failed: " + error.message);
      console.error(error);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voluntary Contribution Repair</CardTitle>
        <CardDescription>
          Fix voluntary contributions that were incorrectly posted to AR, causing inflated recorded_payment values
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={scanForCorruptedContributions} 
          disabled={scanning}
        >
          {scanning ? "Scanning..." : "Scan for Issues"}
        </Button>

        {issues.length > 0 && (
          <>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found {issues.length} corrupted voluntary contribution(s) that need repair
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              {issues.map((issue, idx) => (
                <Alert key={idx} variant="destructive">
                  <AlertDescription>
                    <strong>Student ID:</strong> {issue.student_id.slice(0, 8)}... <br />
                    <strong>Amount:</strong> {issue.amount.toLocaleString('vi-VN')} ₫ <br />
                    <strong>Month:</strong> {issue.month} <br />
                    <strong>Method:</strong> {issue.payment_method} <br />
                    <strong>Issue:</strong> Contribution incorrectly posted to AR, inflating recorded_payment
                  </AlertDescription>
                </Alert>
              ))}
            </div>

            <Button 
              onClick={() => repairMutation.mutate()}
              disabled={repairMutation.isPending}
              variant="destructive"
            >
              {repairMutation.isPending ? "Repairing..." : "Repair All"}
            </Button>
          </>
        )}

        {!scanning && issues.length === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              No corrupted voluntary contributions found
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}