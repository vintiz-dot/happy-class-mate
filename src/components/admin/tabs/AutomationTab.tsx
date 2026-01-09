import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionGenerator } from "@/components/admin/SessionGenerator";
import { ScheduleStatusCard } from "@/components/admin/ScheduleStatusCard";
import { BulkSessionDelete } from "@/components/admin/BulkSessionDelete";
import { BulkEnrollmentDateSetter } from "@/components/admin/BulkEnrollmentDateSetter";
import { BulkRebuildSessions } from "@/components/admin/BulkRebuildSessions";
import { TuitionBulkDownload } from "@/components/admin/TuitionBulkDownload";
import { AttendanceRepairTool } from "@/components/admin/AttendanceRepairTool";
import { ManualTuitionRecalc } from "@/components/admin/ManualTuitionRecalc";
import { LedgerBalanceInspector } from "@/components/admin/LedgerBalanceInspector";
import { InvoiceStatusManager } from "@/components/admin/InvoiceStatusManager";
import { PaymentIntegrityRepair } from "@/components/admin/PaymentIntegrityRepair";
import { VoluntaryContributionRepair } from "@/components/admin/VoluntaryContributionRepair";
import { GenerateTuition } from "@/components/admin/GenerateTuition";
import { XPSettingsManager } from "@/components/admin/XPSettingsManager";
import { Cog, Wrench, Sparkles } from "lucide-react";
import { dayjs } from "@/lib/date";

const AutomationTab = () => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Wrench className="h-6 w-6" />
          Repair & Debugging Tools
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AttendanceRepairTool />
          <ManualTuitionRecalc />
          <LedgerBalanceInspector />
          <InvoiceStatusManager />
          <PaymentIntegrityRepair />
          <VoluntaryContributionRepair />
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Cog className="h-6 w-6" />
          Bulk Operations
        </h2>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Generation</CardTitle>
              <CardDescription>
                Idempotent schedule generation from class templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SessionGenerator />
              <ScheduleStatusCard />
            </CardContent>
          </Card>

          <GenerateTuition />
          <BulkEnrollmentDateSetter />
          <BulkRebuildSessions />
          <BulkSessionDelete />
          <TuitionBulkDownload month={dayjs().format("YYYY-MM")} />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="h-6 w-6" />
          Gamification Settings
        </h2>
        <XPSettingsManager />
      </div>
    </div>
  );
};

export default AutomationTab;
