import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Key, Bell, Palette, Settings, UserCheck } from "lucide-react";
import { UsersSettings } from "./users-settings";
import { AuthSettings } from "./auth-settings";
import { NotificationsSettings } from "./notifications-settings";
import { BrandSettings } from "./brand-settings";
import { FieldsSettings } from "./fields-settings";
import { ResponsaveisSettings } from "./responsaveis-settings";

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Configurações" 
        breadcrumbs={[{ label: "Configurações" }]}
      />

      <main className="flex-1 p-6">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full max-w-4xl grid-cols-6">
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="responsaveis" className="flex items-center gap-2" data-testid="tab-responsaveis">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Responsáveis</span>
            </TabsTrigger>
            <TabsTrigger value="fields" className="flex items-center gap-2" data-testid="tab-fields">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Campos</span>
            </TabsTrigger>
            <TabsTrigger value="auth" className="flex items-center gap-2" data-testid="tab-auth">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">Autenticação</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2" data-testid="tab-notifications">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="brand" className="flex items-center gap-2" data-testid="tab-brand">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Marca</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersSettings />
          </TabsContent>

          <TabsContent value="responsaveis">
            <ResponsaveisSettings />
          </TabsContent>

          <TabsContent value="fields">
            <FieldsSettings />
          </TabsContent>

          <TabsContent value="auth">
            <AuthSettings />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsSettings />
          </TabsContent>

          <TabsContent value="brand">
            <BrandSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
