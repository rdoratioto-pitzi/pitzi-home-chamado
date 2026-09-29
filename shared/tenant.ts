// Isolamento entre tenants: um registro pertence ao tenant de quem o criou.
// Nulo equivale a nulo (instalações de um tenant só guardam tenant_id NULL), então
// dados legados continuam visíveis para usuários sem tenant e invisíveis para os demais.

export function sameTenant(recordTenantId: string | null | undefined, userTenantId: string | null | undefined): boolean {
  return (recordTenantId ?? null) === (userTenantId ?? null);
}
