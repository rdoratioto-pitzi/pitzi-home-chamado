// Configurações → Respostas prontas e Automações. Mesma regra de acesso de "Campos do chamado":
// admins e quem tem a permissão "Gerenciar campos dos chamados".
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, MessageSquareText, Plus, Save, Trash2, Workflow, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSupportGroups } from "@/hooks/use-support-groups";
import { apiErrorMessage, useRequestObjectTree } from "@/hooks/use-ticket-fields";
import { CANNED_RESPONSES_QUERY_KEY } from "@/hooks/use-canned-responses";
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_TRIGGERS,
  IMPACT_OPTIONS,
  type AutomationAction,
  type AutomationConditions,
  type AutomationTrigger,
} from "@shared/automations";
import { TICKET_STATUSES, TICKET_TYPES, ticketStatusLabel, ticketTypeLabel } from "@shared/ticket-options";
import type { AutomationRule, CannedResponse, User } from "@shared/schema";

const ANY = "__any__";
const ALL_GROUPS = "__all__";

// ─── Respostas prontas ────────────────────────────────────────────────────────

interface CannedForm { title: string; body: string; groupKey: string; active: boolean; sortOrder: string }
const EMPTY_CANNED: CannedForm = { title: "", body: "", groupKey: ALL_GROUPS, active: true, sortOrder: "0" };

export function CannedResponsesSettings() {
  const { toast } = useToast();
  const { groups, groupName } = useSupportGroups();
  const { data: responses = [], isLoading } = useQuery<CannedResponse[]>({
    queryKey: [...CANNED_RESPONSES_QUERY_KEY, "all"],
    queryFn: async () => {
      const res = await fetch("/api/canned-responses?all=1", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar respostas prontas");
      return res.json();
    },
  });
  const [editing, setEditing] = useState<CannedResponse | "new" | null>(null);
  const [form, setForm] = useState<CannedForm>(EMPTY_CANNED);

  const refresh = () => queryClient.invalidateQueries({ queryKey: CANNED_RESPONSES_QUERY_KEY });

  const openNew = () => { setForm({ ...EMPTY_CANNED, sortOrder: String(responses.length) }); setEditing("new"); };
  const openEdit = (r: CannedResponse) => {
    setForm({ title: r.title, body: r.body, groupKey: r.groupKey ?? ALL_GROUPS, active: r.active, sortOrder: String(r.sortOrder) });
    setEditing(r);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        body: form.body,
        groupKey: form.groupKey === ALL_GROUPS ? null : form.groupKey,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      };
      return editing === "new" || !editing
        ? apiRequest("POST", "/api/canned-responses", payload)
        : apiRequest("PUT", `/api/canned-responses/${editing.id}`, payload);
    },
    onSuccess: () => { refresh(); setEditing(null); toast({ title: "Resposta salva!" }); },
    onError: (err) => toast({ title: apiErrorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/canned-responses/${id}`),
    onSuccess: () => { refresh(); toast({ title: "Resposta excluída!" }); },
    onError: (err) => toast({ title: apiErrorMessage(err), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Respostas prontas</CardTitle>
        </div>
        <CardDescription>
          Textos que o atendente insere no comentário com um clique. Use {"{{solicitante}}"}, {"{{codigo}}"} e
          {" {{titulo}}"} para preencher com os dados do chamado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={openNew} data-testid="button-add-canned-response">
          <Plus className="h-4 w-4 mr-2" /> Nova resposta
        </Button>
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : responses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma resposta pronta cadastrada.</p>
          ) : (
            responses.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                <span className="font-medium">{r.title}</span>
                <Badge variant="outline">{r.groupKey ? groupName(r.groupKey) : "Todos os grupos"}</Badge>
                {!r.active && <Badge variant="outline" className="text-muted-foreground">Desativada</Badge>}
                <span className="text-sm text-muted-foreground truncate flex-1">{r.body}</span>
                <Button size="icon" variant="ghost" onClick={() => openEdit(r)} data-testid={`button-edit-canned-${r.id}`}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive"
                  onClick={() => { if (window.confirm(`Excluir a resposta "${r.title}"?`)) deleteMutation.mutate(r.id); }}
                  data-testid={`button-delete-canned-${r.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nova resposta pronta" : "Editar resposta pronta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="canned-title">Título</Label>
              <Input id="canned-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="canned-body">Texto</Label>
              <Textarea id="canned-body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="min-h-[160px]" placeholder="Olá {{solicitante}}, recebemos o chamado {{codigo}}..." />
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={form.groupKey} onValueChange={(v) => setForm({ ...form, groupKey: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_GROUPS}>Todos os grupos</SelectItem>
                  {groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <div className="space-y-2">
                <Label htmlFor="canned-order">Ordem</Label>
                <Input id="canned-order" type="number" value={form.sortOrder} className="w-[120px]"
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm pt-6">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                Ativa
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

// ─── Automações ───────────────────────────────────────────────────────────────

interface RuleForm {
  name: string;
  active: boolean;
  trigger: AutomationTrigger;
  type: string;
  group: string;
  impact: string;
  requestObject: string;
  status: string;
  timeoutDays: string;
  sortOrder: string;
  actions: AutomationAction[];
}

const EMPTY_RULE: RuleForm = {
  name: "", active: true, trigger: "ticket_created",
  type: ANY, group: ANY, impact: ANY, requestObject: ANY, status: ANY,
  timeoutDays: "3", sortOrder: "0", actions: [{ type: "add_internal_note", value: "" }],
};

const first = (list?: string[]) => (list && list.length ? list[0] : ANY);
const listOf = (value: string) => (value === ANY ? undefined : [value]);

function ruleToForm(rule: AutomationRule): RuleForm {
  const c = (rule.conditions ?? {}) as AutomationConditions;
  return {
    name: rule.name,
    active: rule.active,
    trigger: rule.trigger as AutomationTrigger,
    type: first(c.types), group: first(c.groups), impact: first(c.impacts),
    requestObject: first(c.requestObjects), status: first(c.statuses),
    timeoutDays: String(rule.timeoutDays ?? 3),
    sortOrder: String(rule.sortOrder),
    actions: Array.isArray(rule.actions) ? (rule.actions as AutomationAction[]) : [],
  };
}

export function AutomationsSettings() {
  const { toast } = useToast();
  const { groups, groupName } = useSupportGroups();
  const tree = useRequestObjectTree();
  const { data: users = [] } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({ queryKey: ["/api/automations"] });
  const [editing, setEditing] = useState<AutomationRule | "new" | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_RULE);

  const activeUsers = users.filter((u) => u.status === "active");
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/automations"] });

  const openNew = () => { setForm({ ...EMPTY_RULE, sortOrder: String(rules.length) }); setEditing("new"); };
  const openEdit = (rule: AutomationRule) => { setForm(ruleToForm(rule)); setEditing(rule); };

  const payload = (f: RuleForm) => ({
    name: f.name,
    active: f.active,
    trigger: f.trigger,
    conditions: {
      types: listOf(f.type),
      groups: listOf(f.group),
      impacts: listOf(f.impact),
      requestObjects: listOf(f.requestObject),
      statuses: f.trigger === "status_changed" ? listOf(f.status) : undefined,
    },
    actions: f.actions,
    timeoutDays: f.trigger === "waiting_requester_timeout" ? Number(f.timeoutDays) : null,
    sortOrder: Number(f.sortOrder) || 0,
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      editing === "new" || !editing
        ? apiRequest("POST", "/api/automations", payload(form))
        : apiRequest("PUT", `/api/automations/${editing.id}`, payload(form)),
    onSuccess: () => { refresh(); setEditing(null); toast({ title: "Automação salva!" }); },
    onError: (err) => toast({ title: apiErrorMessage(err), variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (rule: AutomationRule) => apiRequest("PUT", `/api/automations/${rule.id}`, { active: !rule.active }),
    onSuccess: () => refresh(),
    onError: (err) => toast({ title: apiErrorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/automations/${id}`),
    onSuccess: () => { refresh(); toast({ title: "Automação excluída!" }); },
    onError: (err) => toast({ title: apiErrorMessage(err), variant: "destructive" }),
  });

  const setAction = (index: number, action: AutomationAction) =>
    setForm({ ...form, actions: form.actions.map((a, i) => (i === index ? action : a)) });

  const actionSummary = (a: AutomationAction) => {
    const label = AUTOMATION_ACTION_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
    const value =
      a.type === "set_group" ? groupName(a.value) :
      a.type === "set_status" ? ticketStatusLabel(a.value) :
      a.type === "set_impact" ? IMPACT_OPTIONS.find((i) => i.value === a.value)?.label ?? a.value :
      a.type === "set_assignee" ? userName(a.value) :
      a.type === "notify_user" ? (a.value === "assignee" ? "responsável" : a.value === "requester" ? "solicitante" : userName(a.value)) :
      "nota";
    return `${label}: ${value}`;
  };

  const conditionSelect = (label: string, value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Qualquer</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Automações</CardTitle>
        </div>
        <CardDescription>
          Regras "quando / se / faça" aplicadas aos chamados, na ordem da lista. O que uma automação muda não dispara
          outras automações. Cada execução fica registrada como nota interna no chamado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={openNew} data-testid="button-add-automation">
          <Plus className="h-4 w-4 mr-2" /> Nova automação
        </Button>
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma automação cadastrada.</p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
                <Switch checked={rule.active} onCheckedChange={() => toggleMutation.mutate(rule)}
                  data-testid={`switch-automation-${rule.id}`} />
                <span className="font-medium">{rule.name}</span>
                <Badge variant="outline">
                  {AUTOMATION_TRIGGERS.find((t) => t.value === rule.trigger)?.label.replace("X dias", `${rule.timeoutDays ?? "?"} dias`)}
                </Badge>
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {(Array.isArray(rule.actions) ? (rule.actions as AutomationAction[]) : []).map(actionSummary).join(" · ")}
                </span>
                <Button size="icon" variant="ghost" onClick={() => openEdit(rule)} data-testid={`button-edit-automation-${rule.id}`}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive"
                  onClick={() => { if (window.confirm(`Excluir a automação "${rule.name}"?`)) deleteMutation.mutate(rule.id); }}
                  data-testid={`button-delete-automation-${rule.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nova automação" : "Editar automação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="space-y-1">
                <Label htmlFor="automation-name">Nome</Label>
                <Input id="automation-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="automation-order">Ordem</Label>
                <Input id="automation-order" type="number" value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Quando</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v as AutomationTrigger })}>
                  <SelectTrigger className="w-[340px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUTOMATION_TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.trigger === "waiting_requester_timeout" && (
                  <div className="flex items-center gap-2 text-sm">
                    <Input type="number" min={1} value={form.timeoutDays} className="w-[80px]"
                      onChange={(e) => setForm({ ...form, timeoutDays: e.target.value })} />
                    dias corridos
                  </div>
                )}
              </div>
              {form.trigger === "waiting_requester_timeout" && (
                <p className="text-xs text-muted-foreground">
                  Conferido a cada hora. A automação precisa mudar o status (ex.: Resolvido) para não repetir.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Se o chamado tiver</Label>
              <div className="grid grid-cols-2 gap-3">
                {conditionSelect("Tipo", form.type, (v) => setForm({ ...form, type: v }),
                  TICKET_TYPES.map((t) => ({ value: t.value, label: ticketTypeLabel(t.value) })))}
                {conditionSelect("Grupo", form.group, (v) => setForm({ ...form, group: v }),
                  groups.map((g) => ({ value: g.key, label: g.name })))}
                {conditionSelect("Gravidade", form.impact, (v) => setForm({ ...form, impact: v }), [...IMPACT_OPTIONS])}
                {conditionSelect("Objeto da Requisição", form.requestObject, (v) => setForm({ ...form, requestObject: v }),
                  tree.map((o) => ({ value: o.label, label: o.label })))}
                {form.trigger === "status_changed" &&
                  conditionSelect("Novo status", form.status, (v) => setForm({ ...form, status: v }), [...TICKET_STATUSES])}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Faça</Label>
              {form.actions.map((action, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Select value={action.type}
                    onValueChange={(v) => setAction(index, { type: v as AutomationAction["type"], value: "" } as AutomationAction)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUTOMATION_ACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex-1">
                    {action.type === "add_internal_note" ? (
                      <Textarea value={action.value} className="min-h-[70px]" placeholder="Texto da nota interna"
                        onChange={(e) => setAction(index, { ...action, value: e.target.value })} />
                    ) : (
                      <Select value={action.value || undefined} onValueChange={(v) => setAction(index, { ...action, value: v })}>
                        <SelectTrigger><SelectValue placeholder="Escolha..." /></SelectTrigger>
                        <SelectContent>
                          {action.type === "set_group" && groups.map((g) => <SelectItem key={g.key} value={g.key}>{g.name}</SelectItem>)}
                          {action.type === "set_status" && TICKET_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          {action.type === "set_impact" && IMPACT_OPTIONS.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                          {action.type === "notify_user" && (
                            <>
                              <SelectItem value="assignee">Responsável do chamado</SelectItem>
                              <SelectItem value="requester">Solicitante</SelectItem>
                            </>
                          )}
                          {(action.type === "set_assignee" || action.type === "notify_user") &&
                            activeUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" disabled={form.actions.length === 1}
                    onClick={() => setForm({ ...form, actions: form.actions.filter((_, i) => i !== index) })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {form.actions.length < 10 && (
                <Button variant="outline" size="sm"
                  onClick={() => setForm({ ...form, actions: [...form.actions, { type: "set_status", value: "" } as AutomationAction] })}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar ação
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                O responsável precisa ser membro do grupo do chamado; se não for, a ação é pulada e aparece na nota.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              Ativa
            </label>
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
