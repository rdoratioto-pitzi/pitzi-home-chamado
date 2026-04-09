import { useRef } from "react";
import type { ComponentProps } from "react";
import { Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DateInputProps = Omit<ComponentProps<typeof Input>, "type">;

export function DateInput({ className, ...props }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div className="relative">
      <Input
        {...props}
        ref={inputRef}
        type="date"
        className={cn("pr-10", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full w-10 rounded-l-none border-l border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={openPicker}
        aria-label="Abrir calendário"
      >
        <Calendar className="h-4 w-4" />
      </Button>
    </div>
  );
}
