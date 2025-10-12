import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

const ReportsTab = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Reports
          </CardTitle>
          <CardDescription>
            Generate and view various reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Reports coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
