// Configurações → Campos do chamado: lista do Objeto da Requisição e campos personalizados
// por grupo. Liberado para admins e para quem tem a permissão "Gerenciar campos dos chamados".
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Edit, ListTree, Plus, Save, SlidersHorizontal, Trash2, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSupportGroups } from "@/hooks/use-support-groups";
import {
  apiErrorMessage,
  CUSTOM_FIELDS_QUERY_KEY,
  REQUEST_OBJECTS_QUERY_KEY,
  useCustomFields,
  useRequestObjectTree,
} from "@/hooks/use-ticket-fields";
import {
  REQUEST_ACTION_LABEL,
  REQUEST_DETAIL_LABEL,
  REQUEST_OBJECT_LABEL,
  type RequestObject,
} from "@shared/request-objects";
import { CUSTOM_FIELD_TYPES, customFieldOptions, customFieldTypeLabel } from "@shared/custom-fields";
import type { TicketCustomField } from "@shared/schema";

export function TicketFieldsSettings() {
  return (
    <div className="space-y-6">
      <RequestObjectsEditor />
      <CustomFieldsManager />
    </div>
  );
}

// ─── Objeto da Requisição ─────────────────────────────────────────────────────

interface DraftAction { label: string; details: string }
interface DraftObject { label: string; actions: DraftAction[] }

function toDraft(tree: readonly RequestObject[]): DraftObject[] {
  return tree.map((o) => ({
    label: o.label,
    actions: o.actions.map((a) => ({ label: a.label, details: a.details.join("\n") })),
  }));
}

function fromDraft(draft: DraftObject[]): RequestObject[] {
  return draft.map((o) => ({
    label: o.label,
    actions: o.actions.map((a) => ({
      label: a.label,
      details: a.details.split("\n").map((d) => d.trim()).filter(Boolean),
    })),
  }));
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function RequestObjectsEditor() {
  const { toast } = useToast();
  const tree = useRequestObjectTree();
  const [draft, setDraft] = useState<DraftObject[]>(() => toDraft(tree));
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  // Recarrega do servidor enquanto não houver edição local.
  useEffect(() => {
    if (!dirty) setDraft(toDraft(tree));
  }, [tree, dirty]);

  const update = (next: DraftObject[]) => {
    setDraft(next);
    setDirty(true);
  };
  const updateObject = (i: number, patch: Partial<DraftObject>) =>
    update(draft.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const updateAction = (i: number, j: number, patch: Partial<DraftAction>) =>
    updateObject(i, { actions: draft[i].actions.map((a, idx) => (idx === j ? { ...a, ...patch } : a)) });

  const saveMutation = useMutation({
    mutationFn: async () => apiRequest("PUT", "/api/ticket-fields/request-objects", fromDraft(draft)),
    onSuccess: async (res) => {
      queryClient.setQueryData(REQUEST_OBJECTS_QUERY_KEY, await res.json());
      setDirty(false);
      toast({ title: "Lista do Objeto da Requisição salva!" });
    },
    onError: (err) => toast({ title: apiErrorMessage(err), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ListTree className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">{REQUEST_OBJECT_LABEL}</CardTitle>
        </div>
        <CardDescription>
          Três níveis: {REQUEST_OBJECT_LABEL} → {REQUEST_ACTION_LABEL} → {REQUEST_DETAIL_LABEL}. Chamados antigos
          mantêm o texto que já tinham mesmo se o item for renomeado ou removido daqui.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.map((object, i) => (
          <div key={i} className="border rounded-md bg-muted/30">
            <div className="flex items-center gap-2 p-2">
              <Button size="icon" variant="ghost" onClick={() => setOpen({ ...open, [i]: !open[i] })} aria-label="Expandir">
                {open[i] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              <Input
                value={object.label}
                onChange={(e) => updateObject(i, { label: e.target.value })}
                className="max-w-sm"
                data-testid={`input-request-object-${i}`}
              />
              <Badge variant="outline">{object.actions.length} {object.actions.length === 1 ? "ação" : "ações"}</Badge>
              <div className="flex-1" />
              <Button size="icon" variant="ghost" onClick={() => update(move(draft, i, -1))} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => update(move(draft, i, 1))} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive" aria-label="Remover"
                onClick={() => update(draft.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {open[i] && (
              <div className="pl-12 pr-2 pb-3 space-y-3">
                {object.actions.map((action, j) => (
                  <div key={j} className="space-y-2 border-l pl-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={action.label}
                        onChange={(e) => updateAction(i, j, { label: e.target.value })}
                        className="max-w-sm"
                        placeholder={REQUEST_ACTION_LABEL}
                      />
                      <div className="flex-1" />
                      <Button size="icon" variant="ghost" aria-label="Subir"
                        onClick={() => updateObject(i, { actions: move(object.actions, j, -1) })}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Descer"
                        onClick={() => updateObject(i, { actions: move(object.actions, j, 1) })}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" aria-label="Remover"
                        onClick={() => updateObject(i, { actions: object.actions.filter((_, idx) => idx !== j) })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={action.details}
                      onChange={(e) => updateAction(i, j, { details: e.target.value })}
                      placeholder={`${REQUEST_DETAIL_LABEL}: um por linha (opcional)`}
                      className="min-h-[72px] text-sm"
                    />
                  </div>
                ))}
                <Button variant="outline" size="sm"
                  onClick={() => updateObject(i, { actions: [...object.actions, { label: "Nova ação", details: "" }] })}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar {REQUEST_ACTION_LABEL.toLowerCase()}
                </Button>
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={() => {
            update([...draft, { label: "Novo objeto", actions: [] }]);
            setOpen({ ...open, [draft.length]: true });
          }} data-testid="button-add-request-object">
            <Plus className="h-4 w-4 mr-2" /> Adicionar objeto
          </Button>
          <div className="flex-1" />
          {dirty && (
            <Button variant="ghost" onClick={() => { setDraft(toDraft(tree)); setDirty(false); }}>
              <Undo2 className="h-4 w-4 mr-2" /> Descartar alterações
            </Button>
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending} data-testid="button-save-request-objects">
            <Save className="h-4 w-4 mr-2" /> Salvar lista
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Campos personalizados por grupo ─────────────────────────────────────────

interface FieldForm {
  label: string;
  fieldType: string;
  options: string;
  required: boolean;
  active: boolean;
  sortOrder: string;
}

const EMPTY_FORM: FieldForm = { label: "", fieldType: "text", options: "", required: false, active: true, sortOrder: "0" };

function CustomFieldsManager() {
  const { toast } = useToast();
  const { groups } = useSupportGroups();
  const { fields, isLoading } = useCustomFields();
  const [groupKey, setGroupKey] = useState<string>("");
  const [editing, setEditing] = useState<TicketCustomField | "new" | null>(null);
  const [form, setForm] = useState<FieldForm>(EMPTY_FORM);

  useEffect(() => {
    if (!groupKey && groups.length > 0) setGroupKey(groups[0].key);
  }, [groups, groupKey]);

  const groupFields = fields
    .filter((f) => f.groupKey === groupKey)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  const openNew = () => {
    setForm({ ...EMPTY_FORM, sortOrder: String(groupFields.length) });
    setEditing("new");
  };
  const openEdit = (field: TicketCustomField) => {
    setForm({
      label: field.label,
      fieldType: field.fieldType,
      options: customFieldOptions(field).join("\n"),
      required: field.required,
      active: field.active,
      sortOrder: String(field.sortOrder),
    });
    setEditing(field);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: CUSTOM_FIELDS_QUERY_KEY });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        groupKey,
        label: form.label,
        fieldType: form.fieldType,
        options: form.options.split("\n").map((o) => o.trim()).filter(Boolean),
        required: form.required,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      };
      return editing === "new" || !editing
        ? apiRequest("POST", "/api/ticket-fields/custom", payload)
        : apiRequest("PUT", `/api/ticket-fields/custom/${editing.id}`, payload);
    },
    onSuccess: () => {
      refresh();
      setEditing(null);
      toast({ title: "Campo salvo!" });
    },
    onError: (err) => toast({ title: apiErrorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ticket-fields/custom/${id}`),
    onSuccess: () => {
      refresh();
      toast({ title: "Campo excluído!" });
    },
    onError: (err) => toast({ title: apiErrorMessage(err), variant: "destructive" }),
  });

  const isNew = editing === "new";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Campos personalizados por grupo</CardTitle>
        </div>
        <CardDescription>
          Campos extras que aparecem na abertura e no detalhe dos chamados do grupo. Para esconder um campo sem perder
          os valores já preenchidos, desative-o em vez de excluir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={groupKey} onValueChange={setGroupKey}>
            <SelectTrigger className="w-[260px]" data-testid="select-custom-fields-group">
              <SelectValue placeholder="Grupo de atendimento" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.key} value={g.key}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew} disabled={!groupKey} data-testid="button-add-custom-field">
            <Plus className="h-4 w-4 mr-2" /> Novo campo
          </Button>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : groupFields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Este grupo ainda não tem campos personalizados.</p>
          ) : (
            groupFields.map((field) => (
              <div key={field.id} className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                <span className="font-medium">{field.label}</span>
                <Badge variant="outline">{customFieldTypeLabel(field.fieldType)}</Badge>
                {field.required && <Badge variant="outline">Obrigatório</Badge>}
                {!field.active && <Badge variant="outline" className="text-muted-foreground">Desativado</Badge>}
                <div className="flex-1" />
                <Button size="icon" variant="ghost" onClick={() => openEdit(field)} data-testid={`button-edit-custom-field-${field.id}`}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive"
                  onClick={() => { if (window.confirm(`Excluir o campo "${field.label}"?`)) deleteMutation.mutate(field.id); }}
                  data-testid={`button-delete-custom-field-${field.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isNew ? "Novo campo" : "Editar campo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-field-label">Nome</Label>
              <Input id="custom-field-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.fieldType} onValueChange={(v) => setForm({ ...form, fieldType: v })} disabled={!isNew}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CUSTOM_FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isNew && <p className="text-xs text-muted-foreground">O tipo não pode ser alterado depois de criado.</p>}
            </div>
            {form.fieldType === "select" && (
              <div className="space-y-2">
                <Label htmlFor="custom-field-options">Opções (uma por linha)</Label>
                <Textarea id="custom-field-options" value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })} className="min-h-[120px]" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="custom-field-order">Ordem</Label>
              <Input id="custom-field-order" type="number" value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="w-[120px]" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} />
                Obrigatório na abertura
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                Ativo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
