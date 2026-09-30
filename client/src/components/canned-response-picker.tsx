// Botão "Respostas prontas" da caixa de comentário: insere o texto escolhido, já com os dados
// do chamado. O comentário é HTML (RichTextarea), então o texto vira parágrafos escapados.
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fillCannedResponse, useCannedResponses } from "@/hooks/use-canned-responses";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

export function cannedTextToHtml(text: string): string {
  return text.split("\n").map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("");
}

interface CannedResponsePickerProps {
  groupKey?: string | null;
  ticket: { solicitante?: string | null; codigo?: string | null; titulo?: string | null };
  /** Recebe o HTML a inserir no comentário. */
  onInsert: (html: string) => void;
  size?: "sm" | "default";
}

export function CannedResponsePicker({ groupKey, ticket, onInsert, size = "sm" }: CannedResponsePickerProps) {
  const { responses } = useCannedResponses(groupKey);
  if (responses.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} data-testid="button-canned-responses">
          <MessageSquareText className="w-4 h-4 mr-2" />
          Respostas prontas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] overflow-y-auto w-[280px]">
        <DropdownMenuLabel className="text-xs">Inserir no comentário</DropdownMenuLabel>
        {responses.map((r) => (
          <DropdownMenuItem key={r.id} onSelect={() => onInsert(cannedTextToHtml(fillCannedResponse(r.body, ticket)))}>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{r.title}</span>
              <span className="text-xs text-muted-foreground truncate">{r.body}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
