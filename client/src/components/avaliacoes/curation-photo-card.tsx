import { useState } from "react";
import { ImageOff, ZoomIn, AlertTriangle, Check } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FotoAvaliacao, Grade } from "@/hooks/use-avaliacoes";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurationPhotoCardProps {
  foto: FotoAvaliacao;
  gradeCurador: Grade | null;
  onGradeChange: (grade: Grade) => void;
  highlight?: boolean;
}

// ─── Grade styling ───────────────────────────────────────────────────────────

const GRADE_BADGE: Record<Grade, string> = {
  A: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  C: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const CURATOR_BTN_SELECTED: Record<Grade, string> = {
  A: "bg-[#0F6E56] text-white border-[#0F6E56]",
  B: "bg-[#BA7517] text-white border-[#BA7517]",
  C: "bg-[#A32D2D] text-white border-[#A32D2D]",
};

const CURATOR_BTN_UNSELECTED: Record<Grade, string> = {
  A: "text-green-600 dark:text-green-400 border-green-400 dark:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/30",
  B: "text-amber-600 dark:text-amber-400 border-amber-400 dark:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30",
  C: "text-red-600 dark:text-red-400 border-red-400 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
};

// Short label from full photo type (e.g. "Foto da Tela com IMEI" → "Tela com IMEI")
function shortLabel(tipo: string): string {
  return tipo.replace(/^Foto\s+(da\s+|de\s+)?/i, "");
}

function GradeBadge({ grade, label }: { grade: Grade | null; label: string }) {
  if (!grade) return <span className="text-muted-foreground text-[10px]">{label}: —</span>;
  return (
    <span className="text-[10px] flex items-center gap-0.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("inline-flex items-center rounded px-1 py-0.5 font-bold", GRADE_BADGE[grade])}>
        {grade}
      </span>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CurationPhotoCard({ foto, gradeCurador, onGradeChange, highlight }: CurationPhotoCardProps) {
  const [modalAberto, setModalAberto] = useState(false);

  const divergencia = foto.notaIa !== null && foto.notaHumana !== null && foto.notaIa !== foto.notaHumana;
  const concordam = foto.notaIa !== null && foto.notaHumana !== null && foto.notaIa === foto.notaHumana;

  const needsHighlight = highlight && foto.url !== null && !gradeCurador;

  return (
    <>
      <div
        className={cn(
          "rounded-lg border transition-all flex flex-col",
          needsHighlight
            ? "border-red-400 dark:border-red-600 ring-2 ring-red-200 dark:ring-red-800"
            : "border-border",
        )}
      >
        {/* Thumbnail */}
        {foto.url ? (
          <div
            className="relative group cursor-zoom-in overflow-hidden rounded-t-lg bg-muted/20"
            style={{ aspectRatio: "4/3" }}
            onClick={() => setModalAberto(true)}
          >
            <img
              src={foto.url}
              alt={foto.tipo}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
              <ZoomIn className="h-5 w-5 text-white drop-shadow" />
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center rounded-t-lg bg-zinc-900 dark:bg-zinc-800 gap-1 text-muted-foreground"
            style={{ aspectRatio: "4/3" }}
          >
            <ImageOff className="h-6 w-6 opacity-40" />
            <span className="text-[10px] font-medium opacity-70 text-center px-1">{shortLabel(foto.tipo)}</span>
          </div>
        )}

        {/* Info area below thumbnail */}
        <div className="p-2 flex flex-col gap-1.5">
          {/* Label */}
          <span className="text-xs font-semibold truncate">
            {foto.slot}. {shortLabel(foto.tipo)}
          </span>

          {/* IA + Humano badges + divergence indicator */}
          <div className="flex items-center gap-2 flex-wrap">
            <GradeBadge grade={foto.notaIa} label="IA" />
            <GradeBadge grade={foto.notaHumana} label="Hum" />
            {divergencia && (
              <AlertTriangle className="h-3 w-3 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            )}
            {concordam && (
              <Check className="h-3 w-3 text-green-500 dark:text-green-400 flex-shrink-0" />
            )}
          </div>

          {/* Curator A/B/C buttons */}
          <div className="flex gap-1">
            {(["A", "B", "C"] as Grade[]).map((grade) => {
              const isSelected = gradeCurador === grade;
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => onGradeChange(grade)}
                  className={cn(
                    "flex-1 h-7 rounded border-2 font-bold text-xs transition-all focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-primary",
                    isSelected ? CURATOR_BTN_SELECTED[grade] : cn("bg-transparent", CURATOR_BTN_UNSELECTED[grade])
                  )}
                >
                  {grade}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zoom modal */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-4xl p-2">
          {foto.url && (
            <img
              src={foto.url}
              alt={`${foto.tipo} — ampliada`}
              className="w-full rounded-lg object-contain max-h-[85vh]"
            />
          )}
          <div className="flex items-center justify-between gap-3 px-2 pt-2">
            <div className="flex items-center gap-3">
              <GradeBadge grade={foto.notaIa} label="IA" />
              <GradeBadge grade={foto.notaHumana} label="Humano" />
              {gradeCurador && <GradeBadge grade={gradeCurador} label="Curador" />}
            </div>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Fechar</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
