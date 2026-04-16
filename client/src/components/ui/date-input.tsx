import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DateInputProps = Omit<ComponentProps<typeof Input>, "type">;

export function DateInput({ className, ...props }: DateInputProps) {
  return (
    <Input
      {...props}
      type="date"
      className={cn(className)}
    />
  );
}
