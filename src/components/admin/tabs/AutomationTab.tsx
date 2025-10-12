import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionGenerator } from "@/components/admin/SessionGenerator";
import { Cog } from "lucide-react";

const AutomationTab = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Automation
          </CardTitle>
          <CardDescription>
            Automate repetitive tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionGenerator />
        </CardContent>
      </Card>
    </div>
  );
};

export default AutomationTab;
