import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Undo2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Student {
  id: string;
  full_name: string;
}

interface LedgerAccount {
  id: string;
  code: string;
}

interface LedgerEntry {
  id: string;
  tx_id: string;
  debit: number;
  credit: number;
  memo: string;
  occurred_at: string;
  month: string;
  payment_id?: string;
}

export function LedgerBalanceInspector() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reversingPayment, setReversingPayment] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      loadAccounts();
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedAccount) {
      loadEntries();
    }
  }, [selectedAccount]);

  const loadStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");
    
    if (data) setStudents(data);
  };

  const loadAccounts = async () => {
    const { data } = await supabase
      .from("ledger_accounts")
      .select("*")
      .eq("student_id", selectedStudent);
    
    if (data) setAccounts(data);
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data: ledgerData } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("account_id", selectedAccount)
        .order("occurred_at", { ascending: false })
        .limit(50);
      
      if (ledgerData) {
        // Extract payment IDs from tx_key (format: "payment-{uuid}" or similar)
        const enrichedEntries = ledgerData.map(entry => {
          let paymentId: string | undefined;
          if (entry.tx_key?.includes('payment-')) {
            const match = entry.tx_key.match(/payment-([a-f0-9-]{36})/);
            if (match) paymentId = match[1];
          }
          return {
            ...entry,
            payment_id: paymentId
          };
        });
        
        setEntries(enrichedEntries);
        const bal = enrichedEntries.reduce((sum, e) => sum + e.debit - e.credit, 0);
        setBalance(bal);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReversePayment = async (paymentId: string) => {
    if (!deleteReason.trim()) {
      toast.error("Please provide a reason for reversing this payment");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("delete-payment", {
        body: { paymentId, deleteReason }
      });

      if (error) throw error;

      toast.success("Payment reversed successfully");
      setReversingPayment(null);
      setDeleteReason("");
      loadEntries();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Ledger Balance Inspector
        </CardTitle>
        <CardDescription>
          View ledger entries and account balances
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Student</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Account</Label>
            <Select
              value={selectedAccount}
              onValueChange={setSelectedAccount}
              disabled={!selectedStudent}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedAccount && (
          <>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted">
              <span className="font-semibold">Current Balance:</span>
              <Badge variant={balance > 0 ? "default" : balance < 0 ? "destructive" : "secondary"} className="text-lg">
                {balance.toLocaleString()} ₫
              </Badge>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Memo</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No entries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.occurred_at).toLocaleDateString()}</TableCell>
                        <TableCell>{entry.month}</TableCell>
                        <TableCell className="text-right">
                          {entry.debit > 0 ? entry.debit.toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.credit > 0 ? entry.credit.toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.memo || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.payment_id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReversingPayment(entry.payment_id!)}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <AlertDialog open={!!reversingPayment} onOpenChange={() => setReversingPayment(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reverse Payment</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reverse the payment and all related ledger entries. Invoice statuses will be updated accordingly.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-4">
                  <Label>Reason for reversal (required)</Label>
                  <Textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Explain why this payment is being reversed..."
                    rows={3}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteReason("")}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => reversingPayment && handleReversePayment(reversingPayment)}
                    disabled={!deleteReason.trim()}
                  >
                    Reverse Payment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
