import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, SkipForward, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GradeSelector } from "./grade-selector";
import { ReviewerFlag } from "./reviewer-flag";
import type { TradeInAvaliacao, CuradoriaPayload, Grade } from "@/hooks/use-avaliacoes";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurationCardProps {
  tradeIn: TradeInAvaliacao;
  onConfirm: (dados: CuradoriaPayload) => void;
  onSkip: () => void;
  isSubmitting: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const normalized = dateStr.includes("T")
      ? dateStr
      : dateStr.replace(/^(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1");
    return format(parseISO(normalized), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateStr ?? "—";
  }
}

const CATEGORIA_LABEL: Record<string, string> = {
  iphone: "iPhone",
  smartphone: "Smartphone",
  console: "Console",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CurationCard({ tradeIn, onConfirm, onSkip, isSubmitting }: CurationCardProps) {
  const [gradeDisplay, setGradeDisplay] = useState<Grade | null>(null);
  const [gradeCarcaca, setGradeCarcaca] = useState<Grade | null>(null);
  const [revisaoAtiva, setRevisaoAtiva] = useState(false);
  const [revisaoTipo, setRevisaoTipo] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

  const canConfirm = gradeDisplay !== null && gradeCarcaca !== null;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm({
      tradeInId: tradeIn.tradeInId,
      imei: tradeIn.imei,
      modelo: tradeIn.modelo,
      categoria: tradeIn.categoria,
      gradeIaDisplay: tradeIn.gradeIaDisplay,
      gradeIaCarcaca: tradeIn.gradeIaCarcaca,
      gradeHumanoDisplay: tradeIn.gradeHumanoDisplay,
      gradeHumanoCarcaca: tradeIn.gradeHumanoCarcaca,
      avaliadorHumanoId: tradeIn.avaliadorHumanoId,
      precoMaximo: tradeIn.precoMaximo,
      dataTradeIn: tradeIn.dataTradeIn,
      imagemFrontal: tradeIn.imagemFrontal,
      imagemTraseira: tradeIn.imagemTraseira,
      imagemLateral1: tradeIn.imagemLateral1,
      imagemLateral2: tradeIn.imagemLateral2,
      imagemDetalhe: tradeIn.imagemDetalhe,
      gradeCorretaDisplay: gradeDisplay,
      gradeCorretaCarcaca: gradeCarcaca,
      revisaoAvaliador: revisaoAtiva,
      revisaoTipo: revisaoAtiva ? revisaoTipo : null,
      observacao: observacao.trim() || null,
    });
  }

  function handleToggleRevisao(enabled: boolean) {
    setRevisaoAtiva(enabled);
    if (!enabled) setRevisaoTipo(null);
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-xl font-bold leading-tight">{tradeIn.modelo}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">IMEI: {tradeIn.imei || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {CATEGORIA_LABEL[tradeIn.categoria] ?? tradeIn.categoria}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatDate(tradeIn.dataTradeIn)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 flex-1">
        {/* Grade Display */}
        <GradeSelector
          label="Display & Tela"
          gradeIa={tradeIn.gradeIaDisplay}
          gradeHumano={tradeIn.gradeHumanoDisplay}
          selectedGrade={gradeDisplay}
          onChange={setGradeDisplay}
        />

        <Separator />

        {/* Grade Carcaça */}
        <GradeSelector
          label="Carcaça"
          gradeIa={tradeIn.gradeIaCarcaca}
          gradeHumano={tradeIn.gradeHumanoCarcaca}
          selectedGrade={gradeCarcaca}
          onChange={setGradeCarcaca}
        />

        <Separator />

        {/* Revisão Avaliador */}
        <ReviewerFlag
          enabled={revisaoAtiva}
          tipo={revisaoTipo}
          onToggle={handleToggleRevisao}
          onTipoChange={setRevisaoTipo}
        />

        <Separator />

        {/* Observação */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Observação</label>
            <span className="text-xs text-muted-foreground">{observacao.length}/500</span>
          </div>
          <Textarea
            placeholder="Observação opcional..."
            maxLength={500}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-4">
        <Button
          className="flex-1 bg-[#00A137] hover:bg-[#048E33] text-white"
          onClick={handleConfirm}
          disabled={!canConfirm || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar Curadoria
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onSkip} disabled={isSubmitting} className="gap-2">
          <SkipForward className="h-4 w-4" />
          Pular
        </Button>
      </CardFooter>
    </Card>
  );
}
