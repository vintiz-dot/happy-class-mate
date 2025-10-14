import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DollarSign } from "lucide-react";
import { format } from "date-fns";
import { postStudentPayment } from "@/lib/payments";
import { useQueryClient } from "@tanstack/react-query";

interface Student {
  id: string;
  full_name: string;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  memo: string | null;
  occurred_at: string;
  students: { full_name: string };
}

export function PaymentManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [memo, setMemo] = useState("");
  const [occurredAt, setOccurredAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [studentsRes, paymentsRes] = await Promise.all([
        supabase.from("students").select("id, full_name").eq("is_active", true),
        supabase
          .from("payments" as any)
          .select("*, students(full_name)")
          .order("occurred_at", { ascending: false })
          .limit(20),
      ]);

      if (studentsRes.data) setStudents(studentsRes.data);
      if (paymentsRes.data) setPayments(paymentsRes.data as any);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePostPayment = async () => {
    if (!selectedStudent || !amount) {
      toast({
        title: "Missing fields",
        description: "Please select student and enter amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { month } = await postStudentPayment({
        studentId: selectedStudent,
        amount: parseInt(amount),
        method,
        occurredAt: new Date(occurredAt).toISOString(),
        memo,
      });

      toast({
        title: "Success",
        description: "Payment posted successfully",
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["student-tuition", selectedStudent] });
      queryClient.invalidateQueries({ queryKey: ["admin-finance", month] });
      queryClient.invalidateQueries({ queryKey: ["invoices", selectedStudent] });

      // Reset form
      setSelectedStudent("");
      setAmount("");
      setMemo("");
      setOccurredAt(format(new Date(), "yyyy-MM-dd"));
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Post Payment
          </CardTitle>
          <CardDescription>Record a payment received from a student</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Student *</Label>
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
              <Label>Amount (VND) *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500000"
              />
            </div>

            <div className="space-y-2">
              <Label>Method *</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Memo</Label>
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Optional note about this payment"
                rows={2}
              />
            </div>
          </div>

          <Button onClick={handlePostPayment} disabled={loading} className="w-full mt-4">
            Post Payment
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Last 20 payments received</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payments recorded</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{payment.students.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(payment.occurred_at), "MMM d, yyyy")} • {payment.method}
                    </p>
                    {payment.memo && (
                      <p className="text-sm text-muted-foreground italic">{payment.memo}</p>
                    )}
                  </div>
                  <p className="text-lg font-semibold text-success">
                    {payment.amount.toLocaleString('vi-VN')} ₫
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
