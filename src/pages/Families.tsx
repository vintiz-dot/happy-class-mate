import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { FamilyForm } from "@/components/admin/FamilyForm";
import { FamiliesList } from "@/components/admin/FamiliesList";

const Families = () => {
  const queryClient = useQueryClient();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Families</h1>
          <p className="text-muted-foreground">Manage family accounts and information</p>
        </div>

        <FamilyForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["families-list"] })} />
        <FamiliesList />
      </div>
    </Layout>
  );
};

export default Families;