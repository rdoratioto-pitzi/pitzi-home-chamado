import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useLocation } from "wouter";
import { ApoioVendasInicioTab } from "@/pages/apoio-vendas/inicio";
import { ApoioVendasGestaoTab } from "@/pages/apoio-vendas/gestao";

export default function ApoioVendasPage() {
  const [location, setLocation] = useLocation();
  const activeTab = location.includes("/gestao") ? "gestao" : "inicio";

  const handleTabChange = (value: string) => {
    if (value === "gestao") {
      setLocation("/apoio-vendas/gestao");
      return;
    }
    setLocation("/apoio-vendas");
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Apoio a Vendas"
        description="Painel operacional com dados reais de desempenho de avaliadores"
      />

      <div className="flex-1 p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="inicio">Início</TabsTrigger>
            <TabsTrigger value="gestao">Gestão</TabsTrigger>
          </TabsList>

          <TabsContent value="inicio">
            <ApoioVendasInicioTab />
          </TabsContent>

          <TabsContent value="gestao">
            <ApoioVendasGestaoTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
