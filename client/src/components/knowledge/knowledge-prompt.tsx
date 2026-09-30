// Popup "Transformar em artigo da Base de Conhecimento?" depois que a equipe resolve ou fecha
// um chamado. Quem abriu o chamado não vê. Se o chamado já virou artigo, não pergunta de novo.
import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/queryClient";
import { ArticleEditor, type ArticleFormValues } from "./article-editor";

const CLOSED = new Set(["resolved", "closed"]);

interface Draft extends ArticleFormValues {
  ticketId: string;
}

type Step = { kind: "ask"; draft: Draft } | { kind: "edit"; draft: Draft } | null;

/**
 * Hook: `maybeAsk(ticketId, requesterId, oldStatus, newStatus)` depois de salvar a mudança de
 * status. Renderize `dialog` na tela.
 */
export function useKnowledgePrompt() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(null);

  const maybeAsk = useCallback(async (
    ticketId: string,
    requesterId: string | null | undefined,
    oldStatus: string | null | undefined,
    newStatus: string,
  ) => {
    if (!CLOSED.has(newStatus) || (oldStatus && CLOSED.has(oldStatus))) return;
    if (!user || user.id === requesterId) return;
    try {
      const res = await fetchWithAuth(`/api/conhecimento/chamados/${ticketId}/rascunho`);
      // 403: quem não é da equipe; 404: sem acesso. Em ambos, não pergunta.
      if (!res.ok) return;
      const data: { existingArticleId: string | null; draft: ArticleFormValues | null } = await res.json();
      if (data.existingArticleId || !data.draft) return;
      setStep({ kind: "ask", draft: { ...data.draft, ticketId } });
    } catch {
      // Sugestão é opcional: falha de rede não atrapalha o encerramento.
    }
  }, [user]);

  const dialog = <KnowledgePromptDialog step={step} setStep={setStep} />;
  return { maybeAsk, dialog };
}

function KnowledgePromptDialog({ step, setStep }: { step: Step; setStep: (s: Step) => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const save = async (values: ArticleFormValues, status: "publicado" | "rascunho") => {
    if (!step) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/conhecimento/artigos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, status, sourceTicketId: step.draft.ticketId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Erro ao salvar o artigo");
      queryClient.invalidateQueries({ queryKey: ["/api/conhecimento/artigos"] });
      setStep(null);
      toast({
        title: status === "publicado" ? "Artigo publicado na Base de Conhecimento" : "Rascunho salvo",
        description: "Abra a Base de Conhecimento para ver ou editar.",
      });
      if (status === "publicado") setLocation(`/conhecimento/${body.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erro ao salvar o artigo", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={step !== null} onOpenChange={(open) => { if (!open && !saving) setStep(null); }}>
      {step?.kind === "ask" && (
        <DialogContent className="sm:max-w-md" data-testid="dialog-kb-ask">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Transformar em artigo da Base de Conhecimento?
            </DialogTitle>
            <DialogDescription>
              A solução deste chamado pode ajudar outras pessoas. Vamos montar um rascunho com o
              problema e as respostas públicas (notas internas ficam de fora) para você revisar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setStep(null)} data-testid="button-kb-not-now">Agora não</Button>
            <Button onClick={() => setStep({ kind: "edit", draft: step.draft })} data-testid="button-kb-yes">
              Sim, criar artigo
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
      {step?.kind === "edit" && (
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-kb-edit">
          <DialogHeader>
            <DialogTitle>Novo artigo da Base de Conhecimento</DialogTitle>
            <DialogDescription>Revise o texto antes de publicar.</DialogDescription>
          </DialogHeader>
          <ArticleEditor
            initial={step.draft}
            saving={saving}
            onSubmit={save}
            onCancel={() => setStep(null)}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
