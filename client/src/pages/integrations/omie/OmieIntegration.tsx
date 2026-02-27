import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OmieOverview from './OmieOverview';
import OmieComprasEstoque from './OmieComprasEstoque';
import OmieVendas from './OmieVendas';
import OmieFinancas from './OmieFinancas';
import OmieGeral from './OmieGeral';
import OmieTransporte from './OmieTransporte';

export default function OmieIntegration() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Renov API - Omie</h1>
            <p className="text-muted-foreground">Integração com ERP Omie para gestão empresarial</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <a href="https://developer.omie.com.br/service-list/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Postman Docs
          </a>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="compras">Compras, Estoque e Produção</TabsTrigger>
          <TabsTrigger value="vendas">Vendas e NF-e</TabsTrigger>
          <TabsTrigger value="transporte">Transporte</TabsTrigger>
          <TabsTrigger value="financas">Finanças</TabsTrigger>
          <TabsTrigger value="geral">Geral</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OmieOverview /></TabsContent>
        <TabsContent value="compras"><OmieComprasEstoque /></TabsContent>
        <TabsContent value="vendas"><OmieVendas /></TabsContent>
        <TabsContent value="transporte"><OmieTransporte /></TabsContent>
        <TabsContent value="financas"><OmieFinancas /></TabsContent>
        <TabsContent value="geral"><OmieGeral /></TabsContent>
      </Tabs>
    </div>
  );
}
