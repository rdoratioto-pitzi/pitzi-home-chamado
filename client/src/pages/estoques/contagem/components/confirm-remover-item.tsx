import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ConfirmRemoverItemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  imei: string;
  isLoading: boolean;
}

export function ConfirmRemoverItem({
  open,
  onOpenChange,
  onConfirm,
  imei,
  isLoading,
}: ConfirmRemoverItemProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Remover Item?
          </DialogTitle>
          <DialogDescription className="pt-2">
            Tem certeza que deseja remover o item com IMEI{" "}
            <span className="font-mono font-semibold">{imei}</span> da contagem?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Atenção:</strong> Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
