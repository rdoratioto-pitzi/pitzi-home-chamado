import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

interface ConfirmFinalizarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  totalItens: number;
  isLoading: boolean;
}

export function ConfirmFinalizar({
  open,
  onOpenChange,
  onConfirm,
  totalItens,
  isLoading,
}: ConfirmFinalizarProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Finalizar Contagem?
          </DialogTitle>
          <DialogDescription className="pt-2">
            Você está finalizando a contagem com{" "}
            <span className="font-semibold">{totalItens}</span>{" "}
            {totalItens === 1 ? "item" : "itens"} contados.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Atenção:</strong> Esta ação não pode ser desfeita. 
              Os resultados serão analisados pela equipe administrativa.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Continuar Contando
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizando...
              </>
            ) : (
              "Confirmar Finalização"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SucessoFinalizacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNovaContagem: () => void;
}

export function SucessoFinalizacao({
  open,
  onOpenChange,
  onNovaContagem,
}: SucessoFinalizacaoProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
            Contagem Finalizada!
          </DialogTitle>
          <DialogDescription className="pt-2">
            A contagem foi finalizada com sucesso. 
            Os resultados serão analisados pela equipe administrativa.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            Você receberá uma notificação quando os resultados estiverem disponíveis.
          </p>
        </div>
        
        <DialogFooter className="sm:justify-center">
          <Button onClick={onNovaContagem}>
            Iniciar Nova Contagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}