// Token das APIs em dash.pitzi.com.br. Vem só do secret RENOVSMART_API_TOKEN do Worker:
// sem ele as chamadas falham, em vez de seguir com um valor padrão.

let configuredToken: string | undefined;

/** Chamado a cada requisição (index.ts), para os helpers que não recebem o contexto. */
export function configureRsApiToken(token: string | undefined): void {
  configuredToken = token || undefined;
}

export function rsApiToken(fromEnv?: string): string {
  const token = fromEnv || configuredToken;
  if (!token) throw new Error("RENOVSMART_API_TOKEN não configurado");
  return token;
}
