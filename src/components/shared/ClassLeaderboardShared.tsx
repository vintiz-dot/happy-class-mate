import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClassLeaderboardSharedProps {
  classId: string;
}

export function ClassLeaderboardShared({ classId }: ClassLeaderboardSharedProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["class-leaderboard", classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_points")
        .select(`
          *,
          students (
            id,
            full_name
          )
        `)
        .eq("class_id", classId)
        .eq("month", selectedMonth)
        .order("total_points", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: monthlyLeader } = useQuery({
    queryKey: ["monthly-leader", classId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_leaders")
        .select(`
          *,
          students (
            id,
            full_name
          )
        `)
        .eq("class_id", classId)
        .eq("month", selectedMonth)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-700" />;
      default:
        return <span className="text-muted-foreground">{index + 1}</span>;
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading leaderboard...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Class Leaderboard
            </CardTitle>
            <CardDescription>Top performers in this class</CardDescription>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const month = date.toISOString().slice(0, 7);
                return (
                  <SelectItem key={month} value={month}>
                    {date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {monthlyLeader && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">🏆 Top Student This Month</p>
            <p className="text-lg font-bold">{monthlyLeader.students?.full_name}</p>
            <p className="text-sm text-primary">{monthlyLeader.total_points} points</p>
          </div>
        )}

        {leaderboard?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No scores yet for this month</p>
        ) : (
          <div className="space-y-2">
            {leaderboard?.map((entry: any, index: number) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 flex items-center justify-center">
                    {getRankIcon(index)}
                  </div>
                  <div>
                    <p className="font-medium">{entry.students?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Homework: {entry.homework_points} | Participation: {entry.participation_points}
                    </p>
                  </div>
                </div>
                <Badge variant={index < 3 ? "default" : "secondary"}>
                  {entry.total_points} pts
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
