import { dayjs } from "@/lib/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  maxMonth?: string;
}

export function MonthPicker({ value, onChange, maxMonth }: MonthPickerProps) {
  const currentMonth = maxMonth || dayjs().format("YYYY-MM");
  
  // Generate last 12 months up to current month
  const months = Array.from({ length: 12 }, (_, i) => {
    return dayjs(currentMonth).subtract(i, "month").format("YYYY-MM");
  });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <Calendar className="h-4 w-4 mr-2" />
        <SelectValue>
          {dayjs(value).format("MMMM YYYY")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {months.map((month) => (
          <SelectItem key={month} value={month}>
            {dayjs(month).format("MMMM YYYY")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
