import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionGenerator } from "@/components/admin/SessionGenerator";
import { ScheduleStatusCard } from "@/components/admin/ScheduleStatusCard";
import { PaymentManager } from "@/components/admin/PaymentManager";
import { PayrollManager } from "@/components/admin/PayrollManager";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";
import { BulkSessionDelete } from "@/components/admin/BulkSessionDelete";
import { Cog, DollarSign, Users, Receipt, Percent } from "lucide-react";

const AutomationTab = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Schedule Generation
          </CardTitle>
          <CardDescription>
            Idempotent schedule generation from class templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SessionGenerator />
          <ScheduleStatusCard />
        </CardContent>
      </Card>

      <BulkSessionDelete />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Sibling Discount Computation
          </CardTitle>
          <CardDescription>
            Automatically compute sibling discounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SiblingDiscountCompute />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Payment Management
          </CardTitle>
          <CardDescription>
            Record and manage student payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentManager />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teacher Payroll
          </CardTitle>
          <CardDescription>
            Calculate and export teacher payroll
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PayrollManager />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Discount Management
          </CardTitle>
          <CardDescription>
            Create and manage discount definitions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiscountManager />
        </CardContent>
      </Card>
    </div>
  );
};

export default AutomationTab;
