import { OverviewStats } from "@/components/admin/OverviewStats";
import { LeaderboardResetControl } from "@/components/admin/LeaderboardResetControl";
import { PointsResetControl } from "@/components/admin/PointsResetControl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Activity, Trophy, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const OverviewTab = () => {
  return (
    <div className="space-y-8">
      {/* Stats Section */}
      <section>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 mb-4"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Quick Stats</h2>
            <p className="text-sm text-muted-foreground">Real-time overview of your club</p>
          </div>
        </motion.div>
        <OverviewStats />
      </section>

      {/* Controls Section */}
      <section>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex items-center gap-3 mb-4"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Quick Actions</h2>
            <p className="text-sm text-muted-foreground">Manage leaderboards and points</p>
          </div>
        </motion.div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group overflow-hidden relative">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-amber-500/20" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Leaderboard Control</CardTitle>
                    <CardDescription className="text-xs">Archive and reset monthly rankings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <LeaderboardResetControl />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-lg transition-all duration-300 group overflow-hidden relative">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-violet-500/20" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                    <Star className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Points Control</CardTitle>
                    <CardDescription className="text-xs">Reset student points system</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PointsResetControl />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default OverviewTab;
