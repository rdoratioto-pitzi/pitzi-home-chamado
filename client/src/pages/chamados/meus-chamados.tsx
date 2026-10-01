// "Meus chamados": tela do solicitante ("Usuário", quem não é técnico). Só os chamados que
// ele abriu, com status em linguagem simples. A central completa continua para os técnicos.
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Search, Ticket as TicketIcon, ChevronRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useSupportGroups } from "@/hooks/use-support-groups";
import { requesterStatus } from "@shared/requester-view";
import { RequesterStatusBadge } from "./requester-status-badge";
import type { Ticket } from "@shared/schema";

type Aba = "abertos" | "encerrados";

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy HH:mm");
}

export default function MeusChamadosPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { groupName } = useSupportGroups();
  const [aba, setAba] = useState<Aba>("abertos");
  const [busca, setBusca] = useState("");

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets", "meus"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tickets");
      return res.json();
    },
  });

  const meus = useMemo(
    () =>
      tickets
        .filter((t) => t.requesterId === user?.id)
        .sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()),
    [tickets, user?.id],
  );
  const abertos = meus.filter((t) => requesterStatus(t.status).open);
  const encerrados = meus.filter((t) => !requesterStatus(t.status).open);
  const aguardando = abertos.filter((t) => t.status === "waiting_requester").length;

  const termo = busca.trim().toLowerCase();
  const visiveis = (aba === "abertos" ? abertos : encerrados).filter(
    (t) => !termo || t.title.toLowerCase().includes(termo) || (t.code ?? "").toLowerCase().includes(termo),
  );

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Meus chamados" breadcrumbs={[{ label: "Meus chamados" }]} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Olá{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!</h1>
            <p className="text-sm text-muted-foreground">Acompanhe aqui os chamados que você abriu.</p>
          </div>
          <Button onClick={() => setLocation("/chamados/novo")} style={{ background: "#3B42DE" }} data-testid="button-abrir-chamado">
            <Plus className="h-4 w-4 mr-2" /> Abrir chamado
          </Button>
        </div>

        {aguardando > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            {aguardando === 1
              ? "A equipe está aguardando a sua resposta em 1 chamado."
              : `A equipe está aguardando a sua resposta em ${aguardando} chamados.`}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg border p-1 bg-muted/30 self-start" role="tablist">
            {([["abertos", `Abertos (${abertos.length})`], ["encerrados", `Encerrados (${encerrados.length})`]] as const).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={aba === value}
                onClick={() => setAba(value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${aba === value ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                data-testid={`tab-${value}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou título"
              className="pl-8"
              data-testid="input-buscar-chamados"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : visiveis.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 px-6 text-center space-y-3">
            <TicketIcon className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {termo
                ? "Nenhum chamado encontrado com essa busca."
                : aba === "abertos"
                  ? "Você não tem chamados em aberto."
                  : "Você ainda não tem chamados encerrados."}
            </p>
            {!termo && aba === "abertos" && (
              <Button variant="outline" onClick={() => setLocation("/chamados/novo")}>
                <Plus className="h-4 w-4 mr-2" /> Abrir chamado
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {visiveis.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/chamados/${t.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  data-testid={`meu-chamado-${t.id}`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{t.code}</span>
                      <RequesterStatusBadge status={t.status} />
                    </div>
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {groupName(t.category)} · Atualizado em {formatDate(t.updatedAt ?? t.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
