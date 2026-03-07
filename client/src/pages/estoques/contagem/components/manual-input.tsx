import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Keyboard, X } from "lucide-react";

interface ManualInputProps {
  onSubmit: (imei: string) => void;
  disabled: boolean;
  error: string | null;
}

export function ManualInput({ onSubmit, disabled, error }: ManualInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!error) {
      setInputValue("");
    }
  }, [error]);

  const handleToggle = () => {
    if (isOpen) {
      setInputValue("");
    }
    setIsOpen(!isOpen);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Only numbers
    setInputValue(value);
  };

  const handleSubmit = () => {
    if (inputValue.length === 15) {
      onSubmit(inputValue);
      setInputValue("");
    }
  };

  const handleCancel = () => {
    setInputValue("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Card
        className="border-dashed border-2 cursor-pointer hover:border-primary/70 transition-colors"
        onClick={!disabled ? handleToggle : undefined}
      >
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Keyboard className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="font-medium">Inserção Manual</p>
              <p className="text-sm text-muted-foreground">Digitar IMEI manualmente</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggle}
              disabled={disabled}
            >
              Abrir Input
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-2 border-primary/50">
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">Digite o IMEI</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Digite o IMEI (15 dígitos)"
              maxLength={15}
              disabled={disabled}
              className="text-center text-lg tracking-widest font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.length === 15) {
                  handleSubmit();
                }
              }}
            />

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Dígitos: {inputValue.length}/15</span>
              {inputValue.length > 0 && inputValue.length < 15 && (
                <span className="text-amber-600">Faltam {15 - inputValue.length} dígitos</span>
              )}
              {inputValue.length === 15 && (
                <span className="text-green-600">IMEI completo</span>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={disabled}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={inputValue.length !== 15 || disabled}
              className="flex-1"
            >
              Adicionar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
