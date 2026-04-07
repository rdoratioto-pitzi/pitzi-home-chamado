import { useState } from "react";
import { ImageOff, ZoomIn, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImagemAngulos {
  frontal: string | null;
  traseira: string | null;
  lateral1: string | null;
  lateral2: string | null;
  detalhe: string | null;
}

interface CurationImageViewerProps {
  imagens: ImagemAngulos;
  linkFotos?: string | null;
}

type AnguloKey = keyof ImagemAngulos;

const ANGULO_LABELS: Record<AnguloKey, string> = {
  frontal: "Frontal",
  traseira: "Traseira",
  lateral1: "Lateral 1",
  lateral2: "Lateral 2",
  detalhe: "Detalhe",
};

const ANGULO_KEYS: AnguloKey[] = ["frontal", "traseira", "lateral1", "lateral2", "detalhe"];

// ─── Component ────────────────────────────────────────────────────────────────

export function CurationImageViewer({ imagens, linkFotos }: CurationImageViewerProps) {
  const disponíveis = ANGULO_KEYS.filter((k) => imagens[k] !== null);
  const [ativo, setAtivo] = useState<AnguloKey>(disponíveis[0] ?? "frontal");
  const [modalAberto, setModalAberto] = useState(false);

  const imagemAtual = imagens[ativo];
  const nenhuma = disponíveis.length === 0;

  if (nenhuma) {
    if (linkFotos) {
      return (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border bg-muted/30 gap-4 text-muted-foreground px-6">
          <ExternalLink className="h-12 w-12 opacity-40" />
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-sm font-medium">Fotos disponíveis no sistema RenovSmart</span>
            <span className="text-xs opacity-70">As fotos estão hospedadas no portal de avaliações</span>
          </div>
          <a href={linkFotos} target="_blank" rel="noopener noreferrer">
            <Button className="gap-2 bg-[#00A137] hover:bg-[#048E33] text-white">
              <ExternalLink className="h-4 w-4" />
              Abrir Fotos
            </Button>
          </a>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border bg-muted/30 gap-3 text-muted-foreground">
        <ImageOff className="h-12 w-12 opacity-40" />
        <span className="text-sm font-medium">Imagens não disponíveis para este dispositivo</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Imagem principal */}
      <div
        className="relative group cursor-zoom-in rounded-xl overflow-hidden border border-border bg-muted/20"
        onClick={() => imagemAtual && setModalAberto(true)}
      >
        {imagemAtual ? (
          <>
            <img
              src={imagemAtual}
              alt={`Imagem ${ANGULO_LABELS[ativo]}`}
              className="w-full object-contain max-h-[420px]"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
              <ZoomIn className="h-8 w-8 text-white drop-shadow" />
            </div>
            <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              {ANGULO_LABELS[ativo]}
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8 opacity-40" />
            <span className="text-xs">Indisponível</span>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 flex-wrap">
        {ANGULO_KEYS.map((key) => {
          const url = imagens[key];
          const isAtivo = ativo === key;
          return (
            <button
              key={key}
              onClick={() => setAtivo(key)}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-lg border-2 p-1 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary",
                isAtivo
                  ? "border-[#00A137] ring-1 ring-[#00A137]/30"
                  : "border-border hover:border-muted-foreground/50",
                !url && "opacity-60 cursor-default"
              )}
              title={ANGULO_LABELS[key]}
              disabled={!url}
            >
              {url ? (
                <img
                  src={url}
                  alt={ANGULO_LABELS[key]}
                  className="h-14 w-14 object-cover rounded"
                />
              ) : (
                <div className="h-14 w-14 flex flex-col items-center justify-center bg-muted rounded gap-1">
                  <ImageOff className="h-5 w-5 text-muted-foreground/60" />
                </div>
              )}
              <span className="text-[10px] text-muted-foreground leading-none">{ANGULO_LABELS[key]}</span>
            </button>
          );
        })}
      </div>

      {/* Modal de zoom */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-3xl p-2">
          {imagemAtual && (
            <img
              src={imagemAtual}
              alt={`Imagem ${ANGULO_LABELS[ativo]} ampliada`}
              className="w-full rounded-lg object-contain max-h-[80vh]"
            />
          )}
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="mt-2 w-full">
              Fechar
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
