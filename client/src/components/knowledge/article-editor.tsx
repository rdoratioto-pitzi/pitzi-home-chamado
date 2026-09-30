// Formulário de artigo da Base de Conhecimento: usado no popup ao encerrar chamado e nas
// páginas /conhecimento/novo e /conhecimento/:id/editar.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextarea } from "@/components/rich-textarea";
import { useSupportGroups } from "@/hooks/use-support-groups";
import { Loader2 } from "lucide-react";

export interface ArticleFormValues {
  title: string;
  content: string;
  groupKey: string | null;
}

const NO_GROUP = "__geral__";

export function ArticleEditor({
  initial,
  saving,
  onSubmit,
  onCancel,
  cancelLabel = "Cancelar",
}: {
  initial: ArticleFormValues;
  saving?: boolean;
  onSubmit: (values: ArticleFormValues, status: "publicado" | "rascunho") => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const { groups } = useSupportGroups();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [groupKey, setGroupKey] = useState<string | null>(initial.groupKey);
  // O hook já traz só os grupos ativos; um grupo desativado do artigo continua na lista.
  const options = groupKey && !groups.some((g) => g.key === groupKey)
    ? [...groups, { key: groupKey, name: groupKey }]
    : groups;
  const valid = title.trim().length > 0 && content.replace(/<[^>]*>/g, "").trim().length > 0;

  const submit = (status: "publicado" | "rascunho") => onSubmit({ title: title.trim(), content, groupKey }, status);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="kb-title">Título</Label>
        <Input
          id="kb-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Como reinstalar o cliente VPN"
          maxLength={200}
          data-testid="input-kb-title"
        />
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={groupKey ?? NO_GROUP} onValueChange={(v) => setGroupKey(v === NO_GROUP ? null : v)}>
          <SelectTrigger data-testid="select-kb-group"><SelectValue placeholder="Geral" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_GROUP}>Geral</SelectItem>
            {options.map((g) => (
              <SelectItem key={g.key} value={g.key}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Conteúdo</Label>
        <RichTextarea
          value={content}
          onChange={setContent}
          placeholder="Descreva o problema e a solução passo a passo"
          hideAttachments
          data-testid="input-kb-content"
        />
        <p className="text-xs text-muted-foreground">
          Revise antes de publicar: o artigo fica visível para todos os usuários.
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>{cancelLabel}</Button>
        )}
        <Button variant="outline" onClick={() => submit("rascunho")} disabled={!valid || saving} data-testid="button-kb-draft">
          Salvar como rascunho
        </Button>
        <Button onClick={() => submit("publicado")} disabled={!valid || saving} data-testid="button-kb-publish">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Publicar
        </Button>
      </div>
    </div>
  );
}
