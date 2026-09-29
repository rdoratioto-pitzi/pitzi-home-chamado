// Três selects em cascata para o "Objeto da Requisição" (objeto → ação → detalhe),
// com as listas do Freshdesk em shared/request-objects.ts. O segundo e o terceiro nível
// só aparecem quando o nível anterior tem opções.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  REQUEST_ACTION_LABEL,
  REQUEST_DETAIL_LABEL,
  REQUEST_OBJECT_LABEL,
  REQUEST_OBJECTS,
  requestActionsFor,
  requestDetailsFor,
} from "@shared/request-objects";

export interface RequestObjectValue {
  requestObject: string | null;
  requestAction: string | null;
  requestDetail: string | null;
}

interface RequestObjectSelectProps {
  value: RequestObjectValue;
  onChange: (value: RequestObjectValue) => void;
  disabled?: boolean;
}

// O Radix Select não aceita value="", então "nenhum" usa um marcador próprio.
const NONE = "__none__";

export function RequestObjectSelect({ value, onChange, disabled }: RequestObjectSelectProps) {
  const actions = requestActionsFor(value.requestObject);
  const details = requestDetailsFor(value.requestObject, value.requestAction);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label>{REQUEST_OBJECT_LABEL}</Label>
        <Select
          value={value.requestObject ?? NONE}
          onValueChange={(v) =>
            onChange({ requestObject: v === NONE ? null : v, requestAction: null, requestDetail: null })
          }
          disabled={disabled}
        >
          <SelectTrigger data-testid="select-request-object">
            <SelectValue placeholder="Opcional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Nenhum</SelectItem>
            {REQUEST_OBJECTS.map((o) => (
              <SelectItem key={o.label} value={o.label}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {actions.length > 0 && (
        <div className="space-y-2">
          <Label>{REQUEST_ACTION_LABEL}</Label>
          <Select
            value={value.requestAction ?? NONE}
            onValueChange={(v) =>
              onChange({ ...value, requestAction: v === NONE ? null : v, requestDetail: null })
            }
            disabled={disabled}
          >
            <SelectTrigger data-testid="select-request-action">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a.label} value={a.label}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {details.length > 0 && (
        <div className="space-y-2">
          <Label>{REQUEST_DETAIL_LABEL}</Label>
          <Select
            value={value.requestDetail ?? NONE}
            onValueChange={(v) => onChange({ ...value, requestDetail: v === NONE ? null : v })}
            disabled={disabled}
          >
            <SelectTrigger data-testid="select-request-detail">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {details.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/** Texto curto para exibir a seleção: "Orders › Cancelar" ou "Devices › Alterar Location › 50 Pitzi/Estoque". */
export function formatRequestObject(value: Partial<RequestObjectValue>): string {
  return [value.requestObject, value.requestAction, value.requestDetail].filter(Boolean).join(" › ");
}
