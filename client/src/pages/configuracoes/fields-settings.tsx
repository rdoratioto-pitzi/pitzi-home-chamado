import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X,
  Tag,
  MapPin,
  FolderOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Setting } from "@shared/schema";

interface FieldItem {
  value: string;
  label: string;
}

function FieldManager({ 
  settingKey, 
  title, 
  description,
  icon: Icon,
  defaultItems 
}: { 
  settingKey: string; 
  title: string; 
  description: string;
  icon: React.ElementType;
  defaultItems: FieldItem[];
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
    if (!newItem.value || !newItem.label) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const exists = items.some(i => i.value === newItem.value);
    if (exists) {
      toast({ title: "Este valor já existe", variant: "destructive" });
      return;
    }
    saveMutation.mutate([...items, newItem]);
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
    const newItems = [...items];
    newItems[editingIndex] = editValue;
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
          <Input
            placeholder="Rótulo (ex: TI / Infraestrutura)"
            value={newItem.label}
            onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
            className="flex-1"
            data-testid={`input-${settingKey}-label`}
          />
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
                  <Input
                    value={editValue.label}
                    onChange={(e) => setEditValue({ ...editValue, label: e.target.value })}
                    className="flex-1"
                    data-testid={`input-edit-${settingKey}-label`}
                  />
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
                  <span className="flex-1">{item.label}</span>
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
          Configure as opções disponíveis nos campos dos chamados
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
        </TabsList>

        <TabsContent value="categories">
          <FieldManager 
            settingKey="ticket_categories"
            title="Categorias de Chamados"
            description="Defina as categorias disponíveis para classificar os chamados"
            icon={FolderOpen}
            defaultItems={defaultCategories}
          />
        </TabsContent>

        <TabsContent value="types">
          <FieldManager 
            settingKey="ticket_types"
            title="Tipos de Chamados"
            description="Defina os tipos de chamados (Bug, Melhoria, Negócio, etc.)"
            icon={Tag}
            defaultItems={defaultTypes}
          />
        </TabsContent>

        <TabsContent value="locations">
          <FieldManager 
            settingKey="ticket_locations"
            title="Locais"
            description="Defina os locais/sistemas onde os chamados podem ocorrer"
            icon={MapPin}
            defaultItems={defaultLocations}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
