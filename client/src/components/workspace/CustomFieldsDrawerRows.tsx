// Linhas de campos personalizados no drawer do chamado (workspace). Lê o chamado pelo mesmo
// cache da tela de detalhe (["/api/tickets", id]) e grava pelo PATCH /api/tickets/:id, que
// aplica as mesmas regras de permissão e validação dos outros campos.
import { useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, useCustomFields } from "@/hooks/use-ticket-fields";
import {
  customFieldOptions,
  fieldsForGroup,
  formatCustomFieldValue,
  parseCustomFieldValues,
  type CustomFieldDefinition,
} from "@shared/custom-fields";
import type { Ticket } from "@shared/schema";

const INPUT_STYLE: CSSProperties = {
  background: "hsl(var(--background))",
  border: "1px solid hsl(var(--foreground) / 0.15)",
  color: "hsl(var(--foreground) / 0.7)",
};

export function CustomFieldsDrawerRows({
  ticketId,
  groupKey,
  labelStyle,
}: {
  ticketId: string;
  groupKey: string;
  labelStyle: CSSProperties;
}) {
  const { fields } = useCustomFields();
  const groupFields = fieldsForGroup(fields, groupKey);
  const { data: ticket } = useQuery<Ticket>({
    queryKey: ["/api/tickets", ticketId],
    enabled: groupFields.length > 0,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (groupFields.length === 0 || !ticket) return null;
  const values = parseCustomFieldValues(ticket.customFields);

  async function save(field: CustomFieldDefinition, raw: string) {
    setEditing(null);
    const current = values[field.id] === undefined || values[field.id] === null ? "" : String(values[field.id]);
    if (raw === current) return;
    setSaving(true);
    try {
      const res = await apiRequest("PATCH", `/api/tickets/${ticketId}`, {
        customFields: { [field.id]: raw === "" ? null : raw },
      });
      queryClient.setQueryData(["/api/tickets", ticketId], await res.json());
    } catch (err) {
      const msg = apiErrorMessage(err, "Erro desconhecido");
      toast({ title: "Erro ao atualizar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {groupFields.map((field) => {
        const value = values[field.id];
        const text = value === undefined || value === null ? "" : String(value);
        return (
          <div key={field.id} className="flex items-start gap-3">
            <span style={labelStyle}>{field.label}</span>
            {editing === field.id ? (
              field.fieldType === "select" ? (
                <select
                  autoFocus
                  defaultValue={text}
                  onChange={(e) => save(field, e.target.value)}
                  onBlur={() => setEditing(null)}
                  className="text-xs rounded px-2 py-0.5 outline-none"
                  style={INPUT_STYLE}
                >
                  <option value="">—</option>
                  {customFieldOptions(field).map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  autoFocus
                  type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                  defaultValue={text}
                  onBlur={(e) => save(field, e.target.value.trim())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="text-xs rounded px-2 py-0.5 outline-none flex-1"
                  style={INPUT_STYLE}
                />
              )
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(field.id)}
                className="text-xs text-left whitespace-pre-wrap break-words"
                style={{ color: "hsl(var(--foreground) / 0.65)", cursor: "pointer" }}
                data-testid={`drawer-custom-${field.id}`}
              >
                {formatCustomFieldValue(field, value)}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
