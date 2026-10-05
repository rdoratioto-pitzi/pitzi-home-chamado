// Chamado na visão do solicitante ("Usuário", quem não é técnico): a conversa com a equipe,
// um campo para responder e a avaliação depois de resolvido. Sem campos do atendimento.
import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Paperclip, Plus, Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { RichTextarea } from "@/components/rich-textarea";
import { RichContent } from "@/components/rich-content";
import { CustomFieldValuesList } from "@/components/shared/CustomFieldInputs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useSupportGroups } from "@/hooks/use-support-groups";
import { apiErrorMessage, useCustomFields } from "@/hooks/use-ticket-fields";
import { fieldsForGroup, parseCustomFieldValues } from "@shared/custom-fields";
import type { Ticket, TicketCommentWithUser } from "@shared/schema";
import { TicketSatisfaction } from "./ticket-satisfaction";
import { RequesterStatusBadge } from "./requester-status-badge";

interface Attachment { name: string; url: string }

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy 'às' HH:mm");
}

/** Anexos gravados como JSON: lista de URLs (formato antigo) ou de { name, url }. */
function parseAttachments(raw: string | null | undefined): Attachment[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((a: unknown, i: number) =>
        typeof a === "string" ? { name: `Anexo ${i + 1}`, url: a } : (a as Attachment),
      )
      .filter((a) => a && typeof a.url === "string" && a.url);
  } catch {
    return [];
  }
}

function AttachmentList({ items }: { items: Attachment[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 mt-2">
      {items.map((a, i) => (
        <li key={`${a.url}-${i}`}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            download={a.url.startsWith("data:") ? a.name : undefined}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted transition-colors max-w-[220px]"
          >
            <Paperclip className="h-3 w-3 shrink-0" />
            <span className="truncate">{a.name || `Anexo ${i + 1}`}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function RequesterTicketPage() {
  const { id = "" } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { groupName } = useSupportGroups();
  const { fields: customFields } = useCustomFields();
  const [resposta, setResposta] = useState("");
  const [anexos, setAnexos] = useState<Attachment[]>([]);

  const { data: ticket, isLoading, isError } = useQuery<Ticket>({
    queryKey: ["/api/tickets", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tickets/${id}`);
      return res.json();
    },
  });

  const { data: comments = [] } = useQuery<TicketCommentWithUser[]>({
    queryKey: ["/api/tickets", id, "comments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tickets/${id}/comments`);
      return res.json();
    },
    enabled: !!ticket,
  });

  const responder = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tickets/${id}/comments`, {
        content: resposta,
        attachments: anexos.length > 0 ? JSON.stringify(anexos) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      setResposta("");
      setAnexos([]);
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", id, "comments"] });
      toast({ title: "Resposta enviada", description: "A equipe foi avisada." });
    },
    onError: (error) => toast({ title: apiErrorMessage(error, "Não foi possível enviar a resposta"), variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (isError || !ticket) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">Chamado não encontrado.</p>
        <Button variant="outline" onClick={() => setLocation("/chamados")}>Voltar para meus chamados</Button>
      </div>
    );
  }

  const encerrado = ticket.status === "closed";
  const resolvido = ticket.status === "resolved" || encerrado;
  const camposDoGrupo = fieldsForGroup(customFields, ticket.category);
  const ehSolicitante = ticket.requesterId === user?.id;
  const textoVazio = !resposta.replace(/<[^>]*>/g, "").trim();

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title={ticket.code}
        breadcrumbs={[{ label: "Meus chamados" }, { label: ticket.code }]}
      />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <Link href="/chamados" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Meus chamados
        </Link>

        <section className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{ticket.code}</span>
            <RequesterStatusBadge status={ticket.status} />
          </div>
          <h1 className="text-lg font-bold leading-snug">{ticket.title}</h1>
          <p className="text-xs text-muted-foreground">
            {groupName(ticket.category)} · Aberto em {formatDateTime(ticket.dataAbertura ?? ticket.createdAt)}
          </p>

          {ticket.status === "waiting_requester" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              A equipe está aguardando a sua resposta. Responda logo abaixo para seguirmos com o atendimento.
            </div>
          )}

          <div className="prose prose-sm dark:prose-invert max-w-none pt-1">
            <RichContent content={ticket.description || ""} />
          </div>
          <AttachmentList items={parseAttachments(ticket.attachments)} />
          {camposDoGrupo.length > 0 && (
            <div className="pt-2 border-t">
              <CustomFieldValuesList fields={camposDoGrupo} values={parseCustomFieldValues(ticket.customFields)} />
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Conversa</h2>
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há respostas. Você será avisado por e-mail quando a equipe responder.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const meu = c.userId === user?.id;
                return (
                  <li
                    key={c.id}
                    className={`rounded-xl border p-4 ${meu ? "bg-muted/30" : "bg-card border-primary/20"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium">
                        {meu ? "Você" : c.author?.name || "Equipe"}
                        {c.source === "email" && (
                          <span className="ml-2 text-[10px] font-normal text-muted-foreground border rounded px-1.5 py-0.5">via e-mail</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <RichContent content={c.content} />
                    </div>
                    <AttachmentList items={parseAttachments(c.attachments)} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {!encerrado && (
          <section className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">{resolvido ? "Ainda precisa de ajuda?" : "Responder"}</h2>
            <RichTextarea
              value={resposta}
              onChange={setResposta}
              attachments={anexos}
              onAttachmentsChange={setAnexos}
              placeholder={resolvido ? "Conte o que ainda não foi resolvido..." : "Escreva a sua resposta..."}
              data-testid="requester-resposta"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => responder.mutate()}
                disabled={textoVazio || responder.isPending}
                style={{ background: "#3B42DE" }}
                data-testid="button-enviar-resposta"
              >
                {responder.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar resposta
              </Button>
            </div>
          </section>
        )}

        {resolvido && ehSolicitante && (
          <section className="rounded-xl border bg-card p-4">
            <TicketSatisfaction
              ticket={ticket}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ["/api/tickets", id] })}
            />
          </section>
        )}

        {encerrado && (
          <div className="rounded-xl border border-dashed p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">Este chamado foi encerrado. Se o problema voltou, abra um novo chamado.</p>
            <Button variant="outline" onClick={() => setLocation("/chamados/novo")}>
              <Plus className="h-4 w-4 mr-2" /> Abrir chamado
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
