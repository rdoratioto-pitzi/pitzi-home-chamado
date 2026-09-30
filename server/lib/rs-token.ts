// Token das APIs em dash.pitzi.com.br. Vem só da variável RENOVSMART_API_TOKEN:
// sem ela as chamadas falham, em vez de seguir com um valor padrão.
export function rsApiToken(): string {
  const token = process.env.RENOVSMART_API_TOKEN;
  if (!token) throw new Error("RENOVSMART_API_TOKEN não configurado");
  return token;
}
