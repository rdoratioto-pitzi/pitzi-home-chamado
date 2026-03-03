import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bot, Wrench, Code, Database, Layers } from "lucide-react";

interface PromptFiltersProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  counts?: Record<string, number>;
}

const categories = [
  { id: null, label: "Todas", icon: Layers },
  { id: "development-team", label: "Equipe Dev", icon: Bot },
  { id: "development-tools", label: "Ferramentas", icon: Wrench },
  { id: "programming-languages", label: "Linguagens", icon: Code },
  { id: "database", label: "Database", icon: Database },
];

export function PromptFilters({ selectedCategory, onCategoryChange, counts }: PromptFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const Icon = category.icon;
        const isSelected = selectedCategory === category.id;
        const count = category.id ? counts?.[category.id] : undefined;
        
        return (
          <Button
            key={category.id ?? "all"}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              "gap-2 transition-all",
              isSelected && "shadow-md"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{category.label}</span>
            <span className="sm:hidden">{category.label.split(" ")[0]}</span>
            {count !== undefined && count > 0 && (
              <span className={cn(
                "ml-1 text-xs rounded-full px-1.5 py-0.5",
                isSelected ? "bg-primary-foreground/20" : "bg-muted"
              )}>
                {count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
