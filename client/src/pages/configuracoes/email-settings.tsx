// Configurações → E-mail: situação da conexão, remetente, eventos/modelos, teste e histórico.
// Mesma regra de acesso de "Campos do chamado" (admin ou "Gerenciar campos dos chamados").
// As credenciais do Gmail não aparecem aqui: são segredos do servidor.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Inbox, Mail, RefreshCw, RotateCcw, Save, Send, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiErrorMessage } from "@/hooks/use-ticket-fields";
import {
  EMAIL_EVENTS,
  EMAIL_EVENT_META,
  EMAIL_RECIPIENTS,
  EMAIL_VARIABLES,
  renderSubject,
  renderTemplateText,
  type EmailEvent,
  type EmailRecipient,
  type EmailSettings,
} from "@shared/email-settings";

const RECIPIENT_LABEL: Record<EmailRecipient, string> = {
  solicitante: "Solicitante",
  responsavel: "Responsável",
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Na fila", className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  sending: { label: "Enviando", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  sent: { label: "Enviado", className: "bg-green-500/10 text-green-700 dark:text-green-400" },
  failed: { label: "Falhou", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
  skipped: { label: "Não enviado", className: "bg-muted text-muted-foreground" },
};

const EVENT_LABEL: Record<string, string> = {
  ...Object.fromEntries(EMAIL_EVENTS.map((e) => [e, EMAIL_EVENT_META[e].label])),
  password_reset: "Senha temporária",
  password_reset_link: "Redefinição de senha",
  welcome: "Boas-vindas",
  csat_received: "Avaliação recebida",
  mention: "Menção",
  test: "Teste",
};

const ERROR_LABEL: Record<string, string> = {
  not_configured: "Envio não configurado no servidor",
};

// Exemplo usado na pré-visualização dos modelos.
const PREVIEW_VARS = {
  codigo: "CHA-0123",
  titulo: "Notebook não liga",
  solicitante: "Maria Souza",
  responsavel: "João Lima",
  status: "Em Andamento",
  link: "https://…/chamados/…",
  comentario: "Pode trazer o equipamento amanhã às 10h?",
  alteracoes: "grupo de Suporte TI para Financeiro",
};

interface EmailStatus {
  provider: "gmail" | "sendpulse" | null;
  sender: string | null;
  configured: boolean;
  counts: Record<string, number>;
  note?: string;
}

interface OutboxItem {
  id: string;
  event: string;
  toEmail: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await apiRequest("GET", url);
  return res.json();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function EmailSettingsPanel() {
  return (
    <div className="space-y-6">
      <EmailStatusCard />
      <InboundEmailCard />
      <EmailSettingsForm />
      <EmailOutboxCard />
    </div>
  );
}

function EmailStatusCard() {
  const { toast } = useToast();
  const { data: status, isLoading } = useQuery<EmailStatus>({
    queryKey: ["/api/email/status"],
    queryFn: () => getJson("/api/email/status"),
  });

  const test = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/email/test")).json() as Promise<OutboxItem>,
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/outbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email/status"] });
      if (row.status === "sent") toast({ title: `E-mail de teste enviado para ${row.toEmail}` });
      else toast({ title: "O teste não foi enviado", description: ERROR_LABEL[row.lastError ?? ""] ?? row.lastError ?? undefined, variant: "destructive" });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, "Erro ao enviar o teste"), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Conexão de envio</CardTitle>
        </div>
        <CardDescription>
          Os e-mails saem pela conta do Google Workspace configurada no servidor. As credenciais não
          ficam nesta tela.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : status?.configured ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>
              Conectado via <strong>{status.provider === "gmail" ? "Gmail" : "SendPulse"}</strong>
              {status.sender ? <> como <strong>{status.sender}</strong></> : null}
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm">
            <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <span>
              Envio não configurado. Os e-mails ficam registrados no histórico como "Falhou" até a
              configuração ser concluída; depois é possível reenviá-los.
              {status?.note ? <span className="block text-muted-foreground">{status.note}</span> : null}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(status?.counts ?? {}).map(([key, total]) => (
            <Badge key={key} variant="outline" className={STATUS_LABEL[key]?.className}>
              {STATUS_LABEL[key]?.label ?? key}: {total}
            </Badge>
          ))}
          <div className="flex-1" />
          <Button onClick={() => test.mutate()} disabled={test.isPending} data-testid="button-email-test">
            <Send className="h-4 w-4 mr-2" />
            {test.isPending ? "Enviando..." : "Enviar e-mail de teste"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface InboundOverview {
  status: {
    lastRunAt: string | null;
    ok: boolean;
    scopeOk: boolean | null;
    lastError: string | null;
  } | null;
  last24h: { processed: number; ignored: number; error: number };
  recent: Array<{ createdAt: string; fromEmail: string | null; subject: string | null; status: string; reason: string | null }>;
  scopeHelp: string;
  localOnly?: boolean;
}

const INBOUND_STATUS: Record<string, { label: string; className: string }> = {
  processed: { label: "Virou comentário", className: "bg-green-500/10 text-green-700 dark:text-green-400" },
  ignored: { label: "Ignorada", className: "bg-muted text-muted-foreground" },
  error: { label: "Erro", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

/** Respostas por e-mail: o cron lê a caixa a cada 5 min e grava as respostas no chamado. */
function InboundEmailCard() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<InboundOverview>({
    queryKey: ["/api/email/inbound"],
    queryFn: () => getJson("/api/email/inbound"),
  });
  const run = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/email/inbound/run")).json() as Promise<{ result: { status: string; processed: number; ignored: number; error?: string } }>,
    onSuccess: ({ result }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/inbound"] });
      if (result.status === "ok") toast({ title: `Caixa lida: ${result.processed} resposta(s) importada(s), ${result.ignored} ignorada(s)` });
      else toast({ title: "Não foi possível ler a caixa", description: result.error, variant: "destructive" });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, "Erro ao ler a caixa"), variant: "destructive" }),
  });
  const status = data?.status;
  const scopeMissing = status?.scopeOk === false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Respostas recebidas</CardTitle>
        </div>
        <CardDescription>
          Quem responde um e-mail do chamado tem a resposta gravada no histórico, como comentário.
          A caixa é lida a cada 5 minutos; respostas automáticas e de quem não tem acesso ao chamado
          são ignoradas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : data?.localOnly ? (
          <p className="text-sm text-muted-foreground">A leitura da caixa só funciona no servidor de produção.</p>
        ) : scopeMissing ? (
          <div className="flex items-start gap-2 text-sm">
            <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <span>
              <strong>{data?.scopeHelp}.</strong>{" "}
              <span className="text-muted-foreground">
                No Admin do Google: Segurança → Controles de API → Delegação em todo o domínio, no
                cliente do sistema de chamados, inclua https://www.googleapis.com/auth/gmail.modify.
              </span>
            </span>
          </div>
        ) : status?.ok ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span>Lendo a caixa normalmente. Última leitura: {formatDate(status.lastRunAt)}</span>
          </div>
        ) : status ? (
          <div className="flex items-start gap-2 text-sm">
            <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <span>Falha na última leitura ({formatDate(status.lastRunAt)}): {status.lastError}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">A caixa ainda não foi lida.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={INBOUND_STATUS.processed.className}>Últimas 24 h — importadas: {data?.last24h.processed ?? 0}</Badge>
          <Badge variant="outline" className={INBOUND_STATUS.ignored.className}>ignoradas: {data?.last24h.ignored ?? 0}</Badge>
          {data?.last24h.error ? (
            <Badge variant="outline" className={INBOUND_STATUS.error.className}>com erro: {data.last24h.error}</Badge>
          ) : null}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => run.mutate()} disabled={run.isPending || data?.localOnly} data-testid="button-inbound-run">
            <RefreshCw className={`h-4 w-4 mr-2 ${run.isPending ? "animate-spin" : ""}`} />
            {run.isPending ? "Lendo..." : "Ler a caixa agora"}
          </Button>
        </div>
        {data?.recent?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebida</TableHead>
                <TableHead>De</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDate(row.createdAt)}</TableCell>
                  <TableCell className="text-xs">{row.fromEmail ?? "—"}</TableCell>
                  <TableCell className="text-xs max-w-[260px] truncate">{row.subject ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className={INBOUND_STATUS[row.status]?.className}>
                      {INBOUND_STATUS[row.status]?.label ?? row.status}
                    </Badge>
                    {row.reason ? <span className="block text-muted-foreground mt-1">{row.reason}</span> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmailSettingsForm() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ settings: EmailSettings; defaults: EmailSettings }>({
    queryKey: ["/api/email/settings"],
    queryFn: () => getJson("/api/email/settings"),
  });
  const [form, setForm] = useState<EmailSettings | null>(null);
  const [selected, setSelected] = useState<EmailEvent>("ticket_created");

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const save = useMutation({
    mutationFn: async (settings: EmailSettings) => (await apiRequest("PUT", "/api/email/settings", settings)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/settings"] });
      toast({ title: "Configuração de e-mail salva!" });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, "Erro ao salvar"), variant: "destructive" }),
  });

  const dirty = useMemo(() => !!form && !!data && JSON.stringify(form) !== JSON.stringify(data.settings), [form, data]);

  if (isLoading || !form || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Carregando...</CardContent>
      </Card>
    );
  }

  const event = form.events[selected];
  const setEvent = (patch: Partial<typeof event>) =>
    setForm({ ...form, events: { ...form.events, [selected]: { ...event, ...patch } } });
  const toggleRecipient = (recipient: EmailRecipient, on: boolean) =>
    setEvent({ recipients: on ? [...event.recipients, recipient] : event.recipients.filter((r) => r !== recipient) });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Remetente e notificações</CardTitle>
        <CardDescription>
          Escolha quais e-mails automáticos ficam ativos, quem recebe e o texto de cada um. O e-mail de
          redefinição de senha é sempre enviado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email-sender-name">Nome do remetente</Label>
            <Input
              id="email-sender-name"
              value={form.senderName}
              onChange={(e) => setForm({ ...form, senderName: e.target.value })}
              data-testid="input-email-sender-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-reply-to">Responder para (opcional)</Label>
            <Input
              id="email-reply-to"
              type="email"
              placeholder="Em branco = o próprio remetente"
              value={form.replyTo}
              onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
              data-testid="input-email-reply-to"
            />
          </div>
        </div>

        <div className="space-y-2">
          {EMAIL_EVENTS.map((key) => {
            const cfg = form.events[key];
            return (
              <div
                key={key}
                className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer ${selected === key ? "bg-muted/60 border-primary/40" : "bg-muted/20"}`}
                onClick={() => setSelected(key)}
                data-testid={`row-email-event-${key}`}
              >
                <Switch
                  checked={cfg.enabled}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, events: { ...form.events, [key]: { ...cfg, enabled: checked } } })
                  }
                  data-testid={`switch-email-event-${key}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{EMAIL_EVENT_META[key].label}</div>
                  <div className="text-xs text-muted-foreground">{EMAIL_EVENT_META[key].description}</div>
                </div>
                <div className="hidden sm:flex gap-1">
                  {cfg.recipients.map((r) => (
                    <Badge key={r} variant="outline" className="text-[10px]">{RECIPIENT_LABEL[r]}</Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4 border rounded-md p-4">
          <div className="text-sm font-semibold">{EMAIL_EVENT_META[selected].label}</div>
          <div className="flex flex-wrap gap-4">
            <span className="text-sm text-muted-foreground">Quem recebe:</span>
            {EMAIL_RECIPIENTS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={event.recipients.includes(r)}
                  onCheckedChange={(checked) => toggleRecipient(r, checked === true)}
                  data-testid={`checkbox-email-recipient-${r}`}
                />
                {RECIPIENT_LABEL[r]}
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Assunto</Label>
            <Input
              id="email-subject"
              value={event.subject}
              onChange={(e) => setEvent({ subject: e.target.value })}
              data-testid="input-email-subject"
            />
            <p className="text-xs text-muted-foreground">
              Mantenha o mesmo assunto em todos os eventos para o Gmail agrupar as mensagens de um chamado
              numa conversa só. O código do chamado ([CHA-…]) é sempre incluído.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Texto</Label>
            <Textarea
              id="email-body"
              rows={6}
              value={event.body}
              onChange={(e) => setEvent({ body: e.target.value })}
              data-testid="textarea-email-body"
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: {EMAIL_VARIABLES.map((v) => `{{${v}}}`).join(", ")}. Os detalhes do chamado e o botão
              de acesso são incluídos automaticamente abaixo do texto.
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pré-visualização</div>
            <div className="text-sm font-medium">{renderSubject(event.subject, PREVIEW_VARS)}</div>
            <div className="text-sm whitespace-pre-wrap">{renderTemplateText(event.body, PREVIEW_VARS)}</div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEvent({ subject: data.defaults.events[selected].subject, body: data.defaults.events[selected].body })}
              data-testid="button-email-restore-default"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar texto padrão
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setForm(data.settings)} data-testid="button-email-discard">
            Descartar alterações
          </Button>
          <Button onClick={() => save.mutate(form)} disabled={!dirty || save.isPending} data-testid="button-email-save">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmailOutboxCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const url = `/api/email/outbox?page=${page}&pageSize=20${status !== "all" ? `&status=${status}` : ""}`;
  const { data, isLoading, refetch, isFetching } = useQuery<{ items: OutboxItem[]; total: number; page: number; pageSize: number }>({
    queryKey: ["/api/email/outbox", status, page],
    queryFn: () => getJson(url),
  });

  const resend = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/email/outbox/${id}/resend`)).json() as Promise<OutboxItem>,
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email/outbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email/status"] });
      toast({ title: row.status === "sent" ? "E-mail reenviado" : "Reenvio registrado; confira o status" });
    },
    onError: (err) => toast({ title: apiErrorMessage(err, "Erro ao reenviar"), variant: "destructive" }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico de envios</CardTitle>
        <CardDescription>
          Cada e-mail automático fica registrado aqui. Falhas são tentadas de novo automaticamente (até 5
          vezes); depois disso, use "Reenviar".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]" data-testid="select-email-outbox-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABEL).map(([key, s]) => (
                <SelectItem key={key} value={key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} data-testid="button-email-outbox-refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum e-mail registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Data</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Evento</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Para</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Assunto</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wide">Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id} data-testid={`row-email-outbox-${item.id}`}>
                    <TableCell className="text-[12px] whitespace-nowrap">{formatDate(item.sentAt ?? item.createdAt)}</TableCell>
                    <TableCell className="text-[12px]">{EVENT_LABEL[item.event] ?? item.event}</TableCell>
                    <TableCell className="text-[12px]">{item.toEmail || "—"}</TableCell>
                    <TableCell className="text-[12px] max-w-[280px] truncate" title={item.subject}>{item.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_LABEL[item.status]?.className ?? ""}`}>
                        {STATUS_LABEL[item.status]?.label ?? item.status}
                      </Badge>
                      {item.lastError && item.status !== "sent" && (
                        <div className="text-[10px] text-muted-foreground mt-1 max-w-[220px] truncate" title={item.lastError}>
                          {ERROR_LABEL[item.lastError] ?? item.lastError}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {(item.status === "failed" || item.status === "skipped") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resend.mutate(item.id)}
                          disabled={resend.isPending}
                          data-testid={`button-email-resend-${item.id}`}
                        >
                          Reenviar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span className="text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
