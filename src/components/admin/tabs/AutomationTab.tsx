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
import { dayjs } from "@/lib/date";
import { PageHero } from "@/components/quest/PageHero";
import { SectionHeader } from "@/components/quest/SectionHeader";

const AutomationTab = () => {
  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Operations"
        title="Automation"
        subtitle="Bulk operations, integrity repairs, and gamification settings."
        variant="night"
      />

      <Tabs defaultValue="bulk" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
          <TabsTrigger value="repair">Repair & Debug</TabsTrigger>
          <TabsTrigger value="gamification">Gamification</TabsTrigger>
        </TabsList>

        <TabsContent value="bulk" className="space-y-6">
          <SectionHeader title="Bulk Operations" subtitle="Schedule, tuition, enrolment, downloads." />

          <Card className="surface-2 shadow-q1">
            <CardHeader>
              <CardTitle className="type-h2">Schedule Generation</CardTitle>
              <CardDescription className="type-micro">
                Idempotent schedule generation from class templates.
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
        </TabsContent>

        <TabsContent value="repair" className="space-y-6">
          <SectionHeader
            title="Repair & Debugging"
            subtitle="One-shot tools for fixing data drift."
          />

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
          <SectionHeader title="Gamification" subtitle="XP rules and leaderboard tuning." />
          <XPSettingsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AutomationTab;
