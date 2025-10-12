import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { StudentEditDrawer } from "@/components/admin/StudentEditDrawer";

export function StudentOverviewTab({ student }: { student: any }) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{student.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{student.email || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{student.phone || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date of Birth</p>
              <p className="font-medium">
                {student.date_of_birth ? format(new Date(student.date_of_birth), "MMM d, yyyy") : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={student.is_active ? "default" : "secondary"}>
                {student.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          {student.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm">{student.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          {student.enrollments && student.enrollments.length > 0 ? (
            <div className="space-y-3">
              {student.enrollments.map((enrollment: any) => (
                <div key={enrollment.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{enrollment.class?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Teacher: {enrollment.class?.default_teacher?.full_name || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(enrollment.start_date), "MMM d, yyyy")} 
                      {enrollment.end_date && ` - ${format(new Date(enrollment.end_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {enrollment.class?.session_rate_vnd?.toLocaleString("vi-VN")} ₫
                    </p>
                    {enrollment.discount_type && (
                      <Badge variant="secondary" className="text-xs">
                        {enrollment.discount_type === "percent" ? `${enrollment.discount_value}%` : `${enrollment.discount_value?.toLocaleString("vi-VN")} ₫`} 
                        {" "}off - {enrollment.discount_cadence}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active enrollments</p>
          )}
        </CardContent>
      </Card>

      <StudentEditDrawer
        student={student}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}