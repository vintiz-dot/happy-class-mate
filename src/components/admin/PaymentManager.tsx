import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Plus, Trash2, Edit2, X } from "lucide-react";
import { format } from "date-fns";
import { postStudentPayment } from "@/lib/payments";
import { useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  student_id: string;
}

interface PaymentRow {
  tempId: string;
  studentId: string;
  amount: string;
  method: "cash" | "transfer";
  occurredAt: string;
  memo: string;
}

export function PaymentManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { tempId: crypto.randomUUID(), studentId: "", amount: "", method: "cash", occurredAt: format(new Date(), "yyyy-MM-dd"), memo: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
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

  const addPaymentRow = () => {
    setPaymentRows([...paymentRows, { 
      tempId: crypto.randomUUID(), 
      studentId: "", 
      amount: "", 
      method: "cash", 
      occurredAt: format(new Date(), "yyyy-MM-dd"), 
      memo: "" 
    }]);
  };

  const removePaymentRow = (tempId: string) => {
    if (paymentRows.length === 1) {
      toast({
        title: "Cannot remove",
        description: "At least one payment row is required",
        variant: "destructive",
      });
      return;
    }
    setPaymentRows(paymentRows.filter(row => row.tempId !== tempId));
  };

  const updatePaymentRow = (tempId: string, field: keyof PaymentRow, value: any) => {
    setPaymentRows(paymentRows.map(row => 
      row.tempId === tempId ? { ...row, [field]: value } : row
    ));
  };

  const handlePostPayments = async () => {
    const validRows = paymentRows.filter(row => row.studentId && row.amount);
    
    if (validRows.length === 0) {
      toast({
        title: "Missing fields",
        description: "Please fill in at least one payment with student and amount",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        validRows.map(row => postStudentPayment({
          studentId: row.studentId,
          amount: parseInt(row.amount),
          method: row.method,
          occurredAt: new Date(row.occurredAt).toISOString(),
          memo: row.memo,
        }))
      );

      const succeeded = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      if (succeeded > 0) {
        toast({
          title: "Success",
          description: `${succeeded} payment(s) posted successfully${failed > 0 ? `, ${failed} failed` : ""}`,
        });

        // Invalidate queries for all affected students
        validRows.forEach(row => {
          queryClient.invalidateQueries({ queryKey: ["student-tuition", row.studentId] });
          queryClient.invalidateQueries({ queryKey: ["invoices", row.studentId] });
        });
        
        const uniqueMonths = [...new Set(validRows.map(r => r.occurredAt.slice(0, 7)))];
        uniqueMonths.forEach(month => {
          queryClient.invalidateQueries({ queryKey: ["admin-finance", month] });
        });

        // Reset form
        setPaymentRows([{ tempId: crypto.randomUUID(), studentId: "", amount: "", method: "cash", occurredAt: format(new Date(), "yyyy-MM-dd"), memo: "" }]);
        loadData();
      } else {
        toast({
          title: "Error",
          description: "All payments failed to post",
          variant: "destructive",
        });
      }
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

  const handleEditPayment = async () => {
    if (!editingPayment) return;

    setLoading(true);
    try {
      // Delete old payment
      await supabase.from("payments").delete().eq("id", editingPayment.id);
      
      // Post new payment
      await postStudentPayment({
        studentId: editingPayment.student_id,
        amount: editingPayment.amount,
        method: editingPayment.method,
        occurredAt: editingPayment.occurred_at,
        memo: editingPayment.memo || "",
      });

      toast({
        title: "Success",
        description: "Payment updated successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["student-tuition", editingPayment.student_id] });
      queryClient.invalidateQueries({ queryKey: ["invoices", editingPayment.student_id] });
      
      setEditingPayment(null);
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

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("payments").delete().eq("id", deletePaymentId);
      
      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment deleted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["student-tuition"] });
      queryClient.invalidateQueries({ queryKey: ["admin-finance"] });
      
      setDeletePaymentId(null);
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
            Bulk Post Payments
          </CardTitle>
          <CardDescription>Record multiple payments at once</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Student</TableHead>
                  <TableHead className="w-[140px]">Amount (VND)</TableHead>
                  <TableHead className="w-[120px]">Method</TableHead>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.map((row) => (
                  <TableRow key={row.tempId}>
                    <TableCell>
                      <Select 
                        value={row.studentId} 
                        onValueChange={(v) => updatePaymentRow(row.tempId, "studentId", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.amount}
                        onChange={(e) => updatePaymentRow(row.tempId, "amount", e.target.value)}
                        placeholder="0"
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={row.method} 
                        onValueChange={(v: any) => updatePaymentRow(row.tempId, "method", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={row.occurredAt}
                        onChange={(e) => updatePaymentRow(row.tempId, "occurredAt", e.target.value)}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.memo}
                        onChange={(e) => updatePaymentRow(row.tempId, "memo", e.target.value)}
                        placeholder="Optional note"
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePaymentRow(row.tempId)}
                        className="h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={addPaymentRow} className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
            <Button onClick={handlePostPayments} disabled={loading} className="flex-1">
              Post All Payments
            </Button>
          </div>
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
                  <div className="space-y-1 flex-1">
                    <p className="font-medium">{payment.students.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(payment.occurred_at), "MMM d, yyyy")} • {payment.method}
                    </p>
                    {payment.memo && (
                      <p className="text-sm text-muted-foreground italic">{payment.memo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-semibold text-success">
                      {payment.amount.toLocaleString('vi-VN')} ₫
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingPayment(payment)}
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePaymentId(payment.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Payment Dialog */}
      <AlertDialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Payment</AlertDialogTitle>
            <AlertDialogDescription>Update payment details</AlertDialogDescription>
          </AlertDialogHeader>
          {editingPayment && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Student</label>
                <Select 
                  value={editingPayment.student_id}
                  onValueChange={(v) => setEditingPayment({...editingPayment, student_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <label className="text-sm font-medium">Amount (VND)</label>
                <Input
                  type="number"
                  value={editingPayment.amount}
                  onChange={(e) => setEditingPayment({...editingPayment, amount: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Method</label>
                <Select 
                  value={editingPayment.method}
                  onValueChange={(v: any) => setEditingPayment({...editingPayment, method: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={format(new Date(editingPayment.occurred_at), "yyyy-MM-dd")}
                  onChange={(e) => setEditingPayment({...editingPayment, occurred_at: new Date(e.target.value).toISOString()})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Memo</label>
                <Textarea
                  value={editingPayment.memo || ""}
                  onChange={(e) => setEditingPayment({...editingPayment, memo: e.target.value})}
                  rows={2}
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditPayment} disabled={loading}>
              Update Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the payment record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
