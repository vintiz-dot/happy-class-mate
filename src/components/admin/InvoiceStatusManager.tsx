import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Student {
  id: string;
  full_name: string;
}

export function InvoiceStatusManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentStatus, setCurrentStatus] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (selectedStudent && month) {
      loadInvoiceStatus();
    }
  }, [selectedStudent, month]);

  const loadStudents = async () => {
    const { data } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");
    
    if (data) setStudents(data);
  };

  const loadInvoiceStatus = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("status")
      .eq("student_id", selectedStudent)
      .eq("month", month)
      .maybeSingle();
    
    if (data) {
      setCurrentStatus(data.status);
    } else {
      setCurrentStatus("Not found");
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedStudent || !month || !newStatus || !reason) {
      toast.error("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          status: newStatus as any,
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", selectedStudent)
        .eq("month", month);

      if (error) throw error;

      // Log audit
      await supabase.from("audit_log").insert({
        action: "invoice_status_override",
        entity: "invoice",
        entity_id: `${selectedStudent}-${month}`,
        diff: {
          student_id: selectedStudent,
          month,
          from_status: currentStatus,
          to_status: newStatus,
          reason,
        },
      });

      toast.success("Invoice status updated");
      setCurrentStatus(newStatus);
      setReason("");
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
          <FileCheck className="h-5 w-5" />
          Invoice Status Manager
        </CardTitle>
        <CardDescription>
          Override invoice status for a specific student and month
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
            <Label>Month (YYYY-MM)</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        </div>

        {currentStatus && (
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted">
            <span className="font-medium">Current Status:</span>
            <Badge>{currentStatus}</Badge>
          </div>
        )}

        <div className="space-y-2">
          <Label>New Status</Label>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select new status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Reason (Required)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you're changing the status..."
            rows={3}
          />
        </div>

        <Button
          onClick={handleUpdateStatus}
          disabled={loading || !selectedStudent || !month || !newStatus || !reason}
          className="w-full"
        >
          Update Status
        </Button>
      </CardContent>
    </Card>
  );
}
