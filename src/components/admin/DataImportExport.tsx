import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Database } from "lucide-react";

type TableName = "students" | "teachers" | "families" | "classes" | "enrollments";

export function DataImportExport() {
  const [selectedTable, setSelectedTable] = useState<TableName>("students");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const exportData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(selectedTable)
        .select("*");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No data",
          description: `No data found in ${selectedTable} table`,
          variant: "destructive",
        });
        return;
      }

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(","),
        ...data.map(row =>
          headers.map(header => {
            const value = row[header];
            // Handle special cases
            if (value === null) return "";
            if (typeof value === "object") return JSON.stringify(value);
            if (typeof value === "string" && value.includes(",")) {
              return `"${value}"`;
            }
            return value;
          }).join(",")
        )
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedTable}-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exported",
        description: `${data.length} records exported from ${selectedTable}`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file must have headers and at least one row");
      }

      const headers = lines[0].split(",").map(h => h.trim());
      const records = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const record: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index];
          // Try to parse JSON for object fields
          if (value && (value.startsWith("{") || value.startsWith("["))) {
            try {
              record[header] = JSON.parse(value);
            } catch {
              record[header] = value;
            }
          } else if (value === "" || value === "null") {
            record[header] = null;
          } else {
            record[header] = value;
          }
        });
        
        records.push(record);
      }

      // Import in batches of 100
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase
          .from(selectedTable)
          .upsert(batch);

        if (error) throw error;
      }

      toast({
        title: "Import successful",
        description: `${records.length} records imported to ${selectedTable}`,
      });

      // Reset file input
      event.target.value = "";
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Import / Export
        </CardTitle>
        <CardDescription>Export data to CSV or import from CSV files</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Table</Label>
          <Select value={selectedTable} onValueChange={(v: TableName) => setSelectedTable(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="students">Students</SelectItem>
              <SelectItem value="teachers">Teachers</SelectItem>
              <SelectItem value="families">Families</SelectItem>
              <SelectItem value="classes">Classes</SelectItem>
              <SelectItem value="enrollments">Enrollments</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3">
          <Button onClick={exportData} disabled={loading} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>

          <div className="flex-1">
            <input
              type="file"
              accept=".csv"
              onChange={handleImport}
              disabled={loading}
              className="hidden"
              id="csv-upload"
            />
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <div className="flex items-center justify-center gap-2 h-10 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md transition-colors">
                <Upload className="h-4 w-4" />
                Import from CSV
              </div>
            </Label>
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
          <p className="font-medium mb-1">Import Guidelines:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>CSV must have headers matching database columns</li>
            <li>Empty values will be stored as NULL</li>
            <li>Existing records with same ID will be updated</li>
            <li>JSON fields should be properly formatted</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
