import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Plus, Trash2, Edit2, X, Users } from "lucide-react";
import { format } from "date-fns";
import { postStudentPayment } from "@/lib/payments";
import { useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ModifyPaymentModal } from "./ModifyPaymentModal";
import { FamilyPaymentModal } from "./FamilyPaymentModal";

interface Student {
  id: string;
  full_name: string;
  enrollments?: Array<{
    classes: {
      name: string;
    };
  }>;
}

interface StudentWithBalance extends Student {
  payableBalance?: number;
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
  const [students, setStudents] = useState<StudentWithBalance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { tempId: crypto.randomUUID(), studentId: "", amount: "", method: "cash", occurredAt: format(new Date(), "yyyy-MM-dd"), memo: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [modifyingPayment, setModifyingPayment] = useState<Payment | null>(null);
  const [familyPaymentOpen, setFamilyPaymentOpen] = useState(false);
  const [paymentLimit, setPaymentLimit] = useState(20);
  const [hasMorePayments, setHasMorePayments] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadData();
  }, [paymentLimit]);

  const loadData = async () => {
    try {
      const [studentsRes, paymentsRes] = await Promise.all([
        supabase
          .from("students")
          .select(`
            id, 
            full_name,
            enrollments(
              classes(name)
            )
          `)
          .eq("is_active", true),
        supabase
          .from("payments" as any)
          .select("*, students(full_name)")
          .order("occurred_at", { ascending: false })
          .limit(paymentLimit + 1),
      ]);

      if (studentsRes.data) {
        // Fetch balances for all students
        const studentsWithBalances = await Promise.all(
          studentsRes.data.map(async (student) => {
            try {
              const currentMonth = format(new Date(), "yyyy-MM");
              const { data: financeData } = await supabase.functions.invoke('calculate-tuition', {
                body: { studentId: student.id, month: currentMonth }
              });
              
              // Calculate balance from carry object
              let payableBalance = 0;
              if (financeData?.carry) {
                if (financeData.carry.status === 'debt') {
                  payableBalance = financeData.carry.carryOutDebt || 0;
                } else if (financeData.carry.status === 'credit') {
                  payableBalance = -(financeData.carry.carryOutCredit || 0);
                }
              }
              
              return {
                ...student,
                payableBalance
              };
            } catch {
              return { ...student, payableBalance: 0 };
            }
          })
        );
        setStudents(studentsWithBalances);
      }
      
      if (paymentsRes.data) {
        setHasMorePayments(paymentsRes.data.length > paymentLimit);
        setPayments(paymentsRes.data.slice(0, paymentLimit) as any);
      }
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
      <div className="flex gap-3">
        <Button onClick={() => setFamilyPaymentOpen(true)} variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Post Family Payment
        </Button>
      </div>

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
                  <TableHead className="w-[140px]">Payable Balance</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentRows.map((row) => {
                  const selectedStudent = students.find(s => s.id === row.studentId);
                  const classes = selectedStudent?.enrollments?.map(e => e.classes.name).join(", ") || "—";
                  const balance = selectedStudent?.payableBalance || 0;
                  
                  return (
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
                            {students.map((student) => {
                              const studentClasses = student.enrollments?.map(e => e.classes.name).join(", ") || "—";
                              return (
                                <SelectItem key={student.id} value={student.id}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{student.full_name}</span>
                                    <span className="text-xs text-muted-foreground">{studentClasses}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
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
                      <div className={`text-sm font-medium ${balance > 0 ? 'text-destructive' : balance < 0 ? 'text-success' : 'text-muted-foreground'}`}>
                        {balance.toLocaleString('vi-VN')} ₫
                      </div>
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
                  );
                })}
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
          <CardDescription>Showing {payments.length} recent payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {payments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payments recorded</p>
            ) : (
              <>
                {payments.map((payment) => (
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
                          onClick={() => setModifyingPayment(payment)}
                          className="h-8 w-8"
                          title="Modify Payment"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletePaymentId(payment.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete Payment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMorePayments && (
                  <Button 
                    variant="outline" 
                    onClick={() => setPaymentLimit(prev => prev + 20)}
                    className="w-full"
                  >
                    Load More
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modify Payment Modal */}
      <ModifyPaymentModal
        payment={modifyingPayment}
        onClose={() => setModifyingPayment(null)}
        students={students}
      />

      {/* Family Payment Modal */}
      <FamilyPaymentModal
        open={familyPaymentOpen}
        onClose={() => setFamilyPaymentOpen(false)}
      />

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
