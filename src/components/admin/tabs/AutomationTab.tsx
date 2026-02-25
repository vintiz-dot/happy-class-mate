import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Tabs defaultValue="bulk" className="space-y-6">
      <TabsList>
        <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
        <TabsTrigger value="repair">Repair & Debug</TabsTrigger>
        <TabsTrigger value="gamification">Gamification</TabsTrigger>
      </TabsList>

      <TabsContent value="bulk" className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Cog className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-xl font-semibold">Bulk Operations</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Generation</CardTitle>
            <CardDescription>Idempotent schedule generation from class templates</CardDescription>
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
      </TabsContent>

      <TabsContent value="repair" className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-xl font-semibold">Repair & Debugging Tools</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AttendanceRepairTool />
          <ManualTuitionRecalc />
          <LedgerBalanceInspector />
          <InvoiceStatusManager />
          <PaymentIntegrityRepair />
          <VoluntaryContributionRepair />
        </div>
      </TabsContent>

      <TabsContent value="gamification" className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-xl font-semibold">Gamification Settings</h2>
        </div>
        <XPSettingsManager />
      </TabsContent>
    </Tabs>
  );
};

export default AutomationTab;
