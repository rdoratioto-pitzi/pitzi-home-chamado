import React, { useRef, useState, useEffect } from "react";
import { ScanBarcode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BarcodeReaderProps {
  onScan: (imei: string) => void;
  disabled?: boolean;
}

export function BarcodeReader({ onScan, disabled = false }: BarcodeReaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(false);
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leitores USB enviam os caracteres muito rápido (< 50ms entre keystrokes)
  // e terminam com Enter. Capturamos via input hidden.
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  function handleActivate() {
    setIsActive(true);
    // Pequeno delay para garantir render do input antes do focus
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, "");
    bufferRef.current = value;

    // Auto-submit com 15 dígitos
    if (value.length >= 15) {
      submitImei(value.slice(0, 15));
      e.target.value = "";
      bufferRef.current = "";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const imei = bufferRef.current.replace(/\D/g, "");
      if (imei.length === 15) {
        submitImei(imei);
        (e.target as HTMLInputElement).value = "";
        bufferRef.current = "";
      }
    }
    // Limpar timer de inatividade
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Se o usuário parou de digitar por 3s sem completar, limpar buffer
      bufferRef.current = "";
      if (inputRef.current) inputRef.current.value = "";
    }, 3000);
  }

  function submitImei(imei: string) {
    onScan(imei);
    setIsActive(false);
  }

  function handleBlur() {
    // Pequeno delay para evitar desativar ao clicar em outro elemento
    setTimeout(() => setIsActive(false), 200);
  }

  return (
    <Card
      className={`border-2 border-dashed cursor-pointer transition-colors ${
        isActive
          ? "border-primary bg-primary/5"
          : disabled
          ? "border-muted opacity-50"
          : "border-muted-foreground/30 hover:border-primary/50"
      }`}
      onClick={!disabled && !isActive ? handleActivate : undefined}
    >
      <CardContent className="flex flex-col items-center justify-center gap-3 py-8">
        <ScanBarcode
          className={`h-12 w-12 ${isActive ? "text-primary animate-pulse" : "text-muted-foreground"}`}
        />
        <div className="text-center">
          <p className="font-medium">
            {isActive ? "Aguardando leitura..." : "Leitura por Código de Barras"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isActive ? "Escaneie o IMEI agora" : "Use leitor USB ou câmera"}
          </p>
        </div>
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsActive(false);
            }}
          >
            Cancelar
          </Button>
        )}
        {/* Input oculto para capturar entrada do leitor USB */}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          className="sr-only"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={!isActive || disabled}
          aria-label="Entrada do leitor de código de barras"
        />
      </CardContent>
    </Card>
  );
}
