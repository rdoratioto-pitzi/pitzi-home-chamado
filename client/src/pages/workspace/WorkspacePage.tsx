import { Link } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ChamadosView } from "./ChamadosView";
import { useAuth } from "@/contexts/auth-context";
import { getUserPermissions } from "@/lib/permissions";

export default function WorkspacePage() {
  const { user } = useAuth();
  const permissions = getUserPermissions(user);
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Chamados" actions={permissions.chamados ? (
        <Button size="sm" asChild>
          <Link href="/chamados/novo"><Plus className="h-4 w-4 mr-1" />Novo chamado</Link>
        </Button>
      ) : undefined} />
      <div className="flex-1 overflow-auto p-6"><ChamadosView /></div>
    </div>
  );
}
