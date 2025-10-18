import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterChip {
  key: string;
  label: string;
  count: number;
}

interface TuitionPageFiltersProps {
  filters: FilterChip[];
  activeFilter: string;
  onFilterChange: (key: string) => void;
}

export const TuitionPageFilters = ({
  filters,
  activeFilter,
  onFilterChange,
}: TuitionPageFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-2 sticky top-0 bg-background py-3 border-b z-10">
      {filters.map((filter) => (
        <Badge
          key={filter.key}
          variant={activeFilter === filter.key ? "default" : "outline"}
          className={cn(
            "cursor-pointer hover:bg-primary/10 transition-colors",
            activeFilter === filter.key && "bg-primary text-primary-foreground"
          )}
          onClick={() => onFilterChange(filter.key)}
        >
          {filter.label} ({filter.count})
        </Badge>
      ))}
    </div>
  );
};
