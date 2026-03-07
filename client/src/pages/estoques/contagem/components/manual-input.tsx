import React, { useState, useRef, useEffect } from "react";
import { Keyboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ManualInputProps {
  onSubmit: (imei: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export function ManualInput({ onSubmit, disabled = false, error }: ManualInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imei, setImei] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, "").slice(0, 15);
    setImei(value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && imei.length === 15) {
      handleSubmit();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  }

  function handleSubmit() {
    if (imei.length !== 15) return;
    onSubmit(imei);
    setImei("");
    // Manter aberto para digitação sequencial
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleCancel() {
    setIsOpen(false);
    setImei("");
  }

  const isValid = imei.length === 15;

  if (!isOpen) {
    return (
      <Card
        className={`border-2 border-dashed cursor-pointer transition-colors ${
          disabled
            ? "border-muted opacity-50"
            : "border-muted-foreground/30 hover:border-primary/50"
        }`}
        onClick={!disabled ? () => setIsOpen(true) : undefined}
      >
        <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
          <Keyboard className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">Inserção Manual do IMEI</p>
            <p className="text-sm text-muted-foreground">Clique para digitar o IMEI</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary">
      <CardContent className="flex flex-col gap-4 py-6">
        <div className="flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-primary" />
          <p className="font-medium">Inserção Manual do IMEI</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="imei-input" className="text-sm font-medium">IMEI</label>
          <div className="relative">
            <Input
              id="imei-input"
              ref={inputRef}
              type="text"
              inputMode="numeric"
              placeholder="Digite o IMEI (15 dígitos)"
              value={imei}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className={error ? "border-destructive" : ""}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {imei.length}/15
            </span>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleCancel}
            disabled={disabled}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!isValid || disabled}
          >
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
