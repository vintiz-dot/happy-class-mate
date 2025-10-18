import { useState } from "react";
import { StudentsList } from "@/components/admin/StudentsList";
import { StudentForm } from "@/components/admin/StudentForm";
import { FamilyForm } from "@/components/admin/FamilyForm";
import { StudentsPageFilters } from "@/components/admin/StudentsPageFilters";
import { useQueryClient } from "@tanstack/react-query";

const StudentsTab = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [filterClass, setFilterClass] = useState("all");

  return (
    <div className="space-y-8">
      <FamilyForm onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["families"] });
        queryClient.invalidateQueries({ queryKey: ["students"] });
      }} />
      <StudentForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["students"] })} />
      
      <div className="space-y-4">
        <StudentsPageFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          filterClass={filterClass}
          onFilterClassChange={setFilterClass}
        />
        <StudentsList
          searchQuery={searchQuery}
          sortBy={sortBy}
          filterClass={filterClass}
        />
      </div>
    </div>
  );
};

export default StudentsTab;
