import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
  debit: number;
  credit: number;
  memo: string;
  occurred_at: string;
  month: string;
}

export function LedgerBalanceInspector() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

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
      const { data } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("account_id", selectedAccount)
        .order("occurred_at", { ascending: false })
        .limit(50);
      
      if (data) {
        setEntries(data);
        // Calculate balance
        const bal = data.reduce((sum, e) => sum + e.debit - e.credit, 0);
        setBalance(bal);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
