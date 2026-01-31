import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X,
  Tag,
  MapPin,
  FolderOpen,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Setting, SlaRule } from "@shared/schema";

interface FieldItem {
  value: string;
  label: string;
}

function FieldManager({ 
  settingKey, 
  title, 
  description,
  icon: Icon,
  defaultItems,
  showLabel = true
}: { 
  settingKey: string; 
  title: string; 
  description: string;
  icon: React.ElementType;
  defaultItems: FieldItem[];
  showLabel?: boolean;
}) {
  const { toast } = useToast();
  const [newItem, setNewItem] = useState({ value: "", label: "" });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState({ value: "", label: "" });

  const { data: setting } = useQuery<Setting>({
    queryKey: ["/api/settings", settingKey],
    queryFn: async () => {
      const res = await fetch(`/api/settings/${settingKey}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const items: FieldItem[] = setting?.value 
    ? JSON.parse(setting.value) 
    : defaultItems;

  const saveMutation = useMutation({
    mutationFn: async (newItems: FieldItem[]) => {
      return apiRequest("POST", "/api/settings", {
        key: settingKey,
        value: JSON.stringify(newItems),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings", settingKey] });
      toast({ title: "Configurações salvas!" });
    },
  });

  const handleAdd = () => {
    if (!newItem.value || (showLabel && !newItem.label)) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const finalItem = showLabel ? newItem : { ...newItem, label: newItem.value };
    const exists = items.some(i => i.value === finalItem.value);
    if (exists) {
      toast({ title: "Este valor já existe", variant: "destructive" });
      return;
    }
    saveMutation.mutate([...items, finalItem]);
    setNewItem({ value: "", label: "" });
  };

  const handleRemove = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    saveMutation.mutate(newItems);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    const finalEditValue = showLabel ? editValue : { ...editValue, label: editValue.value };
    const newItems = [...items];
    newItems[editingIndex] = finalEditValue;
    saveMutation.mutate(newItems);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue({ value: "", label: "" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Valor (ex: ti)"
            value={newItem.value}
            onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
            className="flex-1"
            data-testid={`input-${settingKey}-value`}
          />
          {showLabel && (
            <Input
              placeholder="Rótulo (ex: TI / Infraestrutura)"
              value={newItem.label}
              onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
              className="flex-1"
              data-testid={`input-${settingKey}-label`}
            />
          )}
          <Button onClick={handleAdd} data-testid={`button-add-${settingKey}`}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 p-3 border rounded-md bg-muted/30"
            >
              {editingIndex === index ? (
                <>
                  <Input
                    value={editValue.value}
                    onChange={(e) => setEditValue({ ...editValue, value: e.target.value })}
                    className="flex-1"
                    data-testid={`input-edit-${settingKey}-value`}
                  />
                  {showLabel && (
                    <Input
                      value={editValue.label}
                      onChange={(e) => setEditValue({ ...editValue, label: e.target.value })}
                      className="flex-1"
                      data-testid={`input-edit-${settingKey}-label`}
                    />
                  )}
                  <Button size="icon" variant="ghost" onClick={handleSaveEdit}>
                    <Save className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="font-mono">
                    {item.value}
                  </Badge>
                  {showLabel && <span className="flex-1">{item.label}</span>}
                  <div className={showLabel ? "" : "flex-1"} />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleEdit(index)}
                    data-testid={`button-edit-${settingKey}-${index}`}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => handleRemove(index)}
                    className="text-destructive"
                    data-testid={`button-remove-${settingKey}-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const tipoLabels: Record<string, string> = {
  bug: "Bug",
  melhoria: "Melhoria",
};

function SlaManager() {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({ tipo: "", prioridade: "", slaHoras: "" });
  const [editRule, setEditRule] = useState({ tipo: "", prioridade: "", slaHoras: "" });

  const { data: slaRules = [], isLoading } = useQuery<SlaRule[]>({
    queryKey: ["/api/slas"],
  });

  const { data: typesSetting } = useQuery<Setting>({
    queryKey: ["/api/settings", "ticket_types"],
    queryFn: async () => {
      const res = await fetch("/api/settings/ticket_types");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const types: FieldItem[] = typesSetting?.value 
    ? JSON.parse(typesSetting.value)
    : [
        { value: "bug", label: "Bug" },
        { value: "melhoria", label: "Melhoria" },
        { value: "negocio", label: "Negócio" },
      ];

  const priorities = [
    { value: "low", label: "Baixa" },
    { value: "medium", label: "Média" },
    { value: "high", label: "Alta" },
    { value: "critical", label: "Crítica" },
  ];

  const createMutation = useMutation({
    mutationFn: async (data: { tipo: string; prioridade: string; slaHoras: string }) => {
      return apiRequest("POST", "/api/slas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slas"] });
      toast({ title: "Regra de SLA criada com sucesso!" });
      setNewRule({ tipo: "", prioridade: "", slaHoras: "" });
      setIsAdding(false);
    },
    onError: (error: any) => {
      const message = error?.message || "Erro ao criar regra de SLA";
      toast({ title: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { tipo: string; prioridade: string; slaHoras: string } }) => {
      return apiRequest("PUT", `/api/slas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slas"] });
      toast({ title: "Regra de SLA atualizada!" });
      setEditingId(null);
    },
    onError: (error: any) => {
      const message = error?.message || "Erro ao atualizar regra de SLA";
      toast({ title: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/slas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slas"] });
      toast({ title: "Regra de SLA excluída!" });
    },
  });

  const handleAdd = () => {
    if (!newRule.tipo || !newRule.prioridade || !newRule.slaHoras) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    createMutation.mutate(newRule);
  };

  const handleUpdate = () => {
    if (!editingId || !editRule.tipo || !editRule.prioridade || !editRule.slaHoras) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editingId, data: editRule });
  };

  const startEdit = (rule: SlaRule) => {
    setEditingId(rule.id);
    setEditRule({ 
      tipo: rule.tipo, 
      prioridade: rule.prioridade, 
      slaHoras: rule.slaHoras?.toString() || "" 
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Regras de SLA</CardTitle>
        </div>
        <CardDescription>
          Configure o tempo máximo (em horas) para resolução de chamados por tipo e prioridade
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} data-testid="button-add-sla">
            <Plus className="h-4 w-4 mr-2" />
            Nova Regra de SLA
          </Button>
        )}

        {isAdding && (
          <div className="flex flex-wrap gap-2 p-4 border rounded-md bg-muted/30">
            <Select value={newRule.tipo} onValueChange={(v) => setNewRule({ ...newRule, tipo: v })}>
              <SelectTrigger className="w-[160px]" data-testid="select-new-sla-tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label || tipoLabels[t.value.toLowerCase()] || t.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={newRule.prioridade} onValueChange={(v) => setNewRule({ ...newRule, prioridade: v })}>
              <SelectTrigger className="w-[160px]" data-testid="select-new-sla-prioridade">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              placeholder="SLA (horas)"
              value={newRule.slaHoras}
              onChange={(e) => setNewRule({ ...newRule, slaHoras: e.target.value })}
              className="w-[120px]"
              data-testid="input-new-sla-horas"
            />

            <Button onClick={handleAdd} disabled={createMutation.isPending} data-testid="button-save-new-sla">
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
            <Button variant="ghost" onClick={() => setIsAdding(false)} data-testid="button-cancel-new-sla">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : slaRules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma regra de SLA configurada. Clique em "Nova Regra de SLA" para começar.
            </p>
          ) : (
            slaRules.map((rule) => (
              <div 
                key={rule.id}
                className="flex items-center gap-2 p-3 border rounded-md bg-muted/30"
              >
                {editingId === rule.id ? (
                  <>
                    <Select value={editRule.tipo} onValueChange={(v) => setEditRule({ ...editRule, tipo: v })}>
                      <SelectTrigger className="w-[160px]" data-testid={`select-edit-sla-tipo-${rule.id}`}>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {types.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label || tipoLabels[t.value.toLowerCase()] || t.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={editRule.prioridade} onValueChange={(v) => setEditRule({ ...editRule, prioridade: v })}>
                      <SelectTrigger className="w-[160px]" data-testid={`select-edit-sla-prioridade-${rule.id}`}>
                        <SelectValue placeholder="Prioridade" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      value={editRule.slaHoras}
                      onChange={(e) => setEditRule({ ...editRule, slaHoras: e.target.value })}
                      className="w-[120px]"
                      data-testid={`input-edit-sla-horas-${rule.id}`}
                    />

                    <Button size="icon" variant="ghost" onClick={handleUpdate} data-testid={`button-save-edit-sla-${rule.id}`}>
                      <Save className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-sla-${rule.id}`}>
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="font-medium">
                      {tipoLabels[rule.tipo.toLowerCase()] || rule.tipo}
                    </Badge>
                    <Badge variant="outline" className="font-medium">
                      {priorityLabels[rule.prioridade] || rule.prioridade}
                    </Badge>
                    <span className="font-semibold text-primary">{rule.slaHoras}h</span>
                    <div className="flex-1" />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => startEdit(rule)}
                      data-testid={`button-edit-sla-${rule.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="text-destructive"
                      data-testid={`button-delete-sla-${rule.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FieldsSettings() {
  const defaultCategories = [
    { value: "ti", label: "TI / Infraestrutura" },
    { value: "rh", label: "Recursos Humanos" },
    { value: "financeiro", label: "Financeiro" },
    { value: "operacoes", label: "Operações" },
    { value: "comercial", label: "Comercial" },
    { value: "outros", label: "Outros" },
  ];

  const defaultTypes = [
    { value: "bug", label: "Bug" },
    { value: "melhoria", label: "Melhoria" },
    { value: "negocio", label: "Negócio" },
  ];

  const defaultLocations = [
    { value: "RS", label: "RS" },
    { value: "RG", label: "RG" },
    { value: "Dash", label: "Dash" },
    { value: "One", label: "One" },
    { value: "Home", label: "Home" },
    { value: "Omie", label: "Omie" },
    { value: "Outros", label: "Outros" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Campos Dinâmicos</h2>
        <p className="text-sm text-muted-foreground">
          Configure as opções disponíveis nos campos dos chamados e tarefas
        </p>
      </div>

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categories" data-testid="tab-field-categories">
            <FolderOpen className="h-4 w-4 mr-2" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="types" data-testid="tab-field-types">
            <Tag className="h-4 w-4 mr-2" />
            Tipos
          </TabsTrigger>
          <TabsTrigger value="locations" data-testid="tab-field-locations">
            <MapPin className="h-4 w-4 mr-2" />
            Locais
          </TabsTrigger>
          <TabsTrigger value="sla" data-testid="tab-field-sla">
            <Clock className="h-4 w-4 mr-2" />
            SLA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <FieldManager 
            settingKey="ticket_categories"
            title="Categorias de Chamados"
            description="Defina as categorias disponíveis para classificar os chamados"
            icon={FolderOpen}
            defaultItems={defaultCategories}
            showLabel={false}
          />
        </TabsContent>

        <TabsContent value="types">
          <FieldManager 
            settingKey="ticket_types"
            title="Tipos de Chamados"
            description="Defina os tipos de chamados (Bug, Melhoria, Negócio, etc.)"
            icon={Tag}
            defaultItems={defaultTypes}
            showLabel={false}
          />
        </TabsContent>

        <TabsContent value="locations">
          <FieldManager 
            settingKey="ticket_locations"
            title="Locais"
            description="Defina os locais/sistemas onde os chamados podem ocorrer"
            icon={MapPin}
            defaultItems={defaultLocations}
            showLabel={false}
          />
        </TabsContent>

        <TabsContent value="sla">
          <SlaManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
