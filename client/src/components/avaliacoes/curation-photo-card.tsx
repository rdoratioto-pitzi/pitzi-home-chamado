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

const GRADE_COLORS: Record<Grade, { bg: string; text: string; outline: string }> = {
  A: {
    bg: "bg-green-500 text-white border-green-500",
    text: "text-green-600 border-green-500",
    outline: "hover:bg-green-50 dark:hover:bg-green-950/30",
  },
  B: {
    bg: "bg-amber-500 text-white border-amber-500",
    text: "text-amber-600 border-amber-500",
    outline: "hover:bg-amber-50 dark:hover:bg-amber-950/30",
  },
  C: {
    bg: "bg-red-500 text-white border-red-500",
    text: "text-red-600 border-red-500",
    outline: "hover:bg-red-50 dark:hover:bg-red-950/30",
  },
};

const GRADE_BADGE: Record<Grade, string> = {
  A: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  C: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

function GradeBadge({ grade, label }: { grade: Grade | null; label: string }) {
  if (!grade) return <span className="text-muted-foreground text-xs">{label}: —</span>;
  return (
    <span className="text-xs flex items-center gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold", GRADE_BADGE[grade])}>
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

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        highlight && !gradeCurador
          ? "border-red-400 dark:border-red-600 ring-2 ring-red-200 dark:ring-red-800"
          : "border-border",
      )}
    >
      {/* Header: photo type label */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 rounded-t-xl">
        <span className="text-sm font-semibold">
          Foto {foto.slot}: {foto.tipo.replace("Foto da ", "").replace("Foto ", "")}
        </span>
        <span className="text-xs text-muted-foreground capitalize">{foto.area === "display" ? "Display" : "Carcaça"}</span>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">
        {/* Image */}
        {foto.url ? (
          <div
            className="relative group cursor-zoom-in rounded-lg overflow-hidden border border-border bg-muted/20"
            onClick={() => setModalAberto(true)}
          >
            <img
              src={foto.url}
              alt={foto.tipo}
              className="w-full object-contain max-h-[400px]"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
              <ZoomIn className="h-8 w-8 text-white drop-shadow" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 rounded-lg border border-dashed border-border bg-muted/20 gap-2 text-muted-foreground">
            <ImageOff className="h-10 w-10 opacity-40" />
            <span className="text-sm font-medium">Foto não disponível</span>
            <span className="text-xs opacity-70">{foto.tipo}</span>
          </div>
        )}

        {/* Grades row: IA + Humano + divergencia */}
        <div className="flex items-center gap-4 flex-wrap">
          <GradeBadge grade={foto.notaIa} label="IA" />
          <GradeBadge grade={foto.notaHumana} label="Humano" />
          {divergencia && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Divergência</span>
            </div>
          )}
          {concordam && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
              <Check className="h-3.5 w-3.5" />
              <span>Concordam</span>
            </div>
          )}
        </div>

        {/* Curator grade buttons */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Nota do Curador:</span>
          <div className="flex gap-2">
            {(["A", "B", "C"] as Grade[]).map((grade) => {
              const isSelected = gradeCurador === grade;
              const colors = GRADE_COLORS[grade];
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => onGradeChange(grade)}
                  className={cn(
                    "min-h-10 min-w-14 rounded-lg border-2 font-bold text-base transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary",
                    isSelected ? colors.bg : cn("bg-transparent", colors.text, colors.outline)
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
