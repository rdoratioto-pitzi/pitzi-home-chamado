import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Barcode, Loader2 } from "lucide-react";
import { validarIMEI } from "@/lib/validators";

interface BarcodeReaderProps {
  onScan: (imei: string) => void;
  disabled: boolean;
}

export function BarcodeReader({ onScan, disabled }: BarcodeReaderProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isScanning && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isScanning]);

  const handleStartScan = () => {
    setIsScanning(true);
    setInputValue("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Only numbers
    setInputValue(value);
    // Limpa erro de validação quando usuário começa a digitar
    if (validationError) {
      setValidationError(null);
    }
    // Auto-submit quando completar 15 dígitos válidos
    if (value.length === 15) {
      handleSubmit(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.length > 0) {
      // Auto-submit ao detectar Enter (leitor de barcode envia Enter após os dígitos)
      handleSubmit(inputValue);
    } else if (e.key === "Escape") {
      setIsScanning(false);
      setInputValue("");
      setValidationError(null);
    }
  };

  const handleSubmit = (imei: string) => {
    const validacao = validarIMEI(imei);
    if (validacao.valido) {
      onScan(imei);
      setInputValue("");
      setValidationError(null);
      // Mantém o campo aberto para novas leituras
    } else {
      setValidationError(validacao.erro || "IMEI inválido");
    }
  };

  const handleCancel = () => {
    setIsScanning(false);
    setInputValue("");
    setValidationError(null);
  };

  if (isScanning) {
    return (
      <Card className="border-dashed border-2 border-primary/50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Aguardando leitura...</p>

            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Escaneie ou digite o IMEI"
              aria-label="Campo de leitura IMEI — escaneie o código de barras ou digite 15 dígitos"
              className="w-full h-12 text-center text-lg tracking-widest border-2 border-primary rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={15}
              autoComplete="off"
            />

            <p className="text-xs text-muted-foreground">
              {inputValue.length}/15 dígitos
            </p>

            {validationError && (
              <div className="p-2 text-sm text-red-600 bg-red-50 rounded-md">
                {validationError}
              </div>
            )}

            <Button variant="outline" onClick={handleCancel} disabled={disabled}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="border-dashed border-2 cursor-pointer hover:border-primary/70 transition-colors"
      onClick={!disabled ? handleStartScan : undefined}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="p-4 rounded-full bg-primary/10">
            <Barcode className="h-10 w-10 text-primary" />
          </div>
          <div>
            <p className="font-medium">Escanear Código de Barras</p>
            <p className="text-sm text-muted-foreground">Use leitor USB ou câmera</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartScan}
            disabled={disabled}
          >
            Iniciar Leitura
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
