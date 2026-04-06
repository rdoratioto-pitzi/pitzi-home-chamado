import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type Grade = "A" | "B" | "C";

interface GradeSelectorProps {
  label: string;
  gradeIa: Grade | null;
  gradeHumano: Grade | null;
  selectedGrade: Grade | null;
  onChange: (grade: Grade) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const GRADE_BADGE_VARIANT: Record<Grade, string> = {
  A: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  B: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  C: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

const GRADE_DESC: Record<Grade, string> = {
  A: "Excelente, sinais mínimos",
  B: "Bom, uso moderado",
  C: "Desgaste severo",
};

function GradeBadge({ grade }: { grade: Grade | null }) {
  if (!grade) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", GRADE_BADGE_VARIANT[grade])}>
      {grade}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GradeSelector({ label, gradeIa, gradeHumano, selectedGrade, onChange }: GradeSelectorProps) {
  const divergencia = gradeIa !== null && gradeHumano !== null && gradeIa !== gradeHumano;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{label}</p>

      {/* Referências IA / Humano */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">IA:</span>
          <GradeBadge grade={gradeIa} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium">Humano:</span>
          <GradeBadge grade={gradeHumano} />
        </div>
        {divergencia && (
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Divergência</span>
          </div>
        )}
      </div>

      {/* Botões de seleção */}
      <div className="flex gap-2">
        {(["A", "B", "C"] as Grade[]).map((grade) => {
          const isSelected = selectedGrade === grade;
          const colors = GRADE_COLORS[grade];
          return (
            <div key={grade} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => onChange(grade)}
                className={cn(
                  "min-h-12 min-w-16 rounded-lg border-2 font-bold text-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary",
                  isSelected ? colors.bg : cn("bg-transparent", colors.text, colors.outline)
                )}
              >
                {grade}
              </button>
              <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[64px]">
                {GRADE_DESC[grade]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
