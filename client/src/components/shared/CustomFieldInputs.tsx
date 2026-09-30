// Campos personalizados do grupo do chamado (Configurações → Campos do chamado).
// Os valores são indexados pelo id do campo; regras em shared/custom-fields.ts.
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  customFieldOptions,
  formatCustomFieldValue,
  type CustomFieldDefinition,
  type CustomFieldValues,
} from "@shared/custom-fields";

const NONE = "__none__";

interface CustomFieldInputsProps {
  fields: readonly CustomFieldDefinition[];
  values: CustomFieldValues;
  onChange: (values: CustomFieldValues) => void;
  disabled?: boolean;
}

export function CustomFieldInputs({ fields, values, onChange, disabled }: CustomFieldInputsProps) {
  if (fields.length === 0) return null;
  const set = (id: string, value: string | number | null) => onChange({ ...values, [id]: value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {fields.map((field) => {
        const value = values[field.id];
        const text = value === null || value === undefined ? "" : String(value);
        const label = (
          <Label htmlFor={`custom-${field.id}`}>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
        );
        if (field.fieldType === "textarea") {
          return (
            <div key={field.id} className="space-y-2 sm:col-span-2">
              {label}
              <Textarea
                id={`custom-${field.id}`}
                value={text}
                onChange={(e) => set(field.id, e.target.value)}
                disabled={disabled}
                data-testid={`input-custom-${field.id}`}
              />
            </div>
          );
        }
        if (field.fieldType === "select") {
          const options = customFieldOptions(field);
          if (text && !options.includes(text)) options.push(text);
          return (
            <div key={field.id} className="space-y-2">
              {label}
              <Select
                value={text || NONE}
                onValueChange={(v) => set(field.id, v === NONE ? null : v)}
                disabled={disabled}
              >
                <SelectTrigger id={`custom-${field.id}`} data-testid={`select-custom-${field.id}`}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <Input
              id={`custom-${field.id}`}
              type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
              value={text}
              onChange={(e) => set(field.id, e.target.value)}
              disabled={disabled}
              data-testid={`input-custom-${field.id}`}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Lista "Campo: valor" só leitura. */
export function CustomFieldValuesList({ fields, values }: { fields: readonly CustomFieldDefinition[]; values: CustomFieldValues }) {
  if (fields.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {fields.map((field) => (
        <div key={field.id}>
          <dt className="text-xs text-muted-foreground">{field.label}</dt>
          <dd className="whitespace-pre-wrap break-words">{formatCustomFieldValue(field, values[field.id])}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Primeiro obrigatório sem valor (para avisar antes de enviar), ou null. */
export function missingRequiredField(fields: readonly CustomFieldDefinition[], values: CustomFieldValues): string | null {
  const missing = fields.find((f) => f.required && (values[f.id] === undefined || values[f.id] === null || values[f.id] === ""));
  return missing ? missing.label : null;
}
