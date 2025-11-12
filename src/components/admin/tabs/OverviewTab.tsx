import { OverviewStats } from "@/components/admin/OverviewStats";
import { LeaderboardResetControl } from "@/components/admin/LeaderboardResetControl";
import { PointsResetControl } from "@/components/admin/PointsResetControl";

const OverviewTab = () => {
  return (
    <div className="space-y-6">
      <OverviewStats />
      <div className="grid gap-6 md:grid-cols-2">
        <LeaderboardResetControl />
        <PointsResetControl />
      </div>
    </div>
  );
};

export default OverviewTab;
