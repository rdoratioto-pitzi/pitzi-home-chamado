import { useState, useEffect, useCallback } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bot, Check, Sparkles } from "lucide-react";
import { usePrompts, usePromptByName } from "@/hooks/use-prompts";
import { cn } from "@/lib/utils";

interface PromptCommandProps {
  onSelectPrompt: (content: string) => void;
  disabled?: boolean;
}

export function PromptCommand({ onSelectPrompt, disabled }: PromptCommandProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [commandSearch, setCommandSearch] = useState("");
  
  // Busca todos os prompts
  const { data: prompts = [], isLoading } = usePrompts();
  
  // Busca específica quando o usuário digita "/prompt nome"
  const promptNameMatch = commandSearch.match(/^\/prompt\s+(\S+)/);
  const promptName = promptNameMatch?.[1] || "";
  
  const { data: specificPrompt } = usePromptByName(promptName, !!promptName);

  // Filtra prompts baseado na busca
  const filteredPrompts = search
    ? prompts.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase())
      )
    : prompts;

  // Agrupa por categoria
  const groupedPrompts = filteredPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, typeof prompts>);

  const handleSelect = (content: string) => {
    onSelectPrompt(content);
    setOpen(false);
    setSearch("");
  };

  // Categorias em português
  const categoryLabels: Record<string, string> = {
    "development-team": "Equipe de Desenvolvimento",
    "development-tools": "Ferramentas",
    "programming-languages": "Linguagens",
    "database": "Banco de Dados",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Inserir prompt...</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Digite /prompt
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar prompt ou digite /prompt nome..."
            value={search}
            onValueChange={(value) => {
              setSearch(value);
              setCommandSearch(value);
            }}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                "Carregando prompts..."
              ) : (
                <div className="py-6 text-center text-sm">
                  <p className="text-muted-foreground">Nenhum prompt encontrado.</p>
                  <p className="text-xs mt-1">
                    Tente buscar por outro termo ou use /prompt nome
                  </p>
                </div>
              )}
            </CommandEmpty>
            
            {specificPrompt && (
              <CommandGroup heading="Prompt Encontrado">
                <CommandItem
                  onSelect={() => handleSelect(specificPrompt.content)}
                  className="flex flex-col items-start gap-1 p-3"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="font-medium">{specificPrompt.title}</span>
                    <Check className="ml-auto h-4 w-4 opacity-0 group-data-[selected=true]:opacity-100" />
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {specificPrompt.description}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            
            {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
              <CommandGroup key={category} heading={categoryLabels[category] || category}>
                {categoryPrompts.map((prompt) => (
                  <CommandItem
                    key={prompt.id}
                    onSelect={() => handleSelect(prompt.content)}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Bot className="h-4 w-4 text-primary" />
                      <span className="font-medium">{prompt.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2 pl-6">
                      {prompt.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Hook para detectar comando /prompt em textarea
export function usePromptCommand(
  value: string,
  onInsertPrompt: (content: string) => void
) {
  const [showCommand, setShowCommand] = useState(false);
  const [commandValue, setCommandValue] = useState("");
  
  useEffect(() => {
    // Detecta "/prompt " no texto
    const match = value.match(/\/prompt\s+(\S*)/);
    if (match) {
      setShowCommand(true);
      setCommandValue(match[1]);
    } else {
      setShowCommand(false);
      setCommandValue("");
    }
  }, [value]);
  
  return { showCommand, commandValue };
}
