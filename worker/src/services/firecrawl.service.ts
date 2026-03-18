/**
 * Firecrawl Service — Scraping de preços do Mercado Livre
 * Usa Firecrawl API para buscar anúncios e calcular estatísticas de preços
 */

// ── Interfaces ──────────────────────────────────────────────────────

export interface FirecrawlAd {
  title: string;
  price: number;
  link: string;
  condition: string;
}

export interface FirecrawlPricingResult {
  query: string;
  source: "mercadolivre";
  scrapedAt: string;
  totalAds: number;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  ads: FirecrawlAd[];
}

// ── Constantes ──────────────────────────────────────────────────────

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

const PRICING_KEYWORDS = [
  "preço", "preco", "quanto custa", "valor",
  "mercado livre", "mercadolivre",
  "iphone", "samsung", "xiaomi", "motorola", "redmi",
  "smartphone", "celular",
  "usado", "seminovo", "semi-novo",
  "trade-in", "tradein",
];

// ── Funções Públicas ────────────────────────────────────────────────

/**
 * Detecta se a mensagem do usuário é uma consulta de preços
 */
export function detectPricingQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return PRICING_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Busca preços no Mercado Livre via Firecrawl search API
 */
export async function scrapeMercadoLivre(
  query: string,
  apiKey?: string,
): Promise<FirecrawlPricingResult | null> {
  if (!apiKey) {
    console.error("[Firecrawl] FIRECRAWL_API_KEY não configurada");
    return null;
  }

  try {
    console.log(`[Firecrawl] Buscando preços para: "${query}"`);

    const searchQuery = `${query} usado site:mercadolivre.com.br`;

    const response = await fetch(`${FIRECRAWL_API_URL}/search`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 15,
        lang: "pt-br",
        country: "br",
        scrapeOptions: {
          formats: ["json"],
          jsonOptions: {
            prompt: "Extraia o título do anúncio, preço em reais (apenas número), link do anúncio e condição (usado/seminovo/novo)",
            schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título do anúncio" },
                price: { type: "number", description: "Preço em reais (apenas número, sem R$)" },
                link: { type: "string", description: "URL do anúncio" },
                condition: { type: "string", description: "Condição: usado, seminovo ou novo" },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Firecrawl] Erro na API (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    const ads = extractAdsFromResults(data);

    if (ads.length === 0) {
      console.warn("[Firecrawl] Nenhum anúncio com preço encontrado");
      return null;
    }

    const prices = ads.map((a) => a.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);

    const result: FirecrawlPricingResult = {
      query,
      source: "mercadolivre",
      scrapedAt: new Date().toISOString(),
      totalAds: ads.length,
      minPrice,
      avgPrice,
      maxPrice,
      ads: ads.slice(0, 10),
    };

    console.log(
      `[Firecrawl] ${ads.length} anúncios encontrados — Min: R$${minPrice} | Avg: R$${avgPrice} | Max: R$${maxPrice}`
    );

    return result;
  } catch (error) {
    console.error("[Firecrawl] Erro ao buscar preços:", error);
    return null;
  }
}

/**
 * Formata resultado de preços como contexto markdown para o system prompt
 */
export function formatPricingContext(result: FirecrawlPricingResult): string {
  const lines: string[] = [
    `## Pesquisa de Preços — Mercado Livre`,
    `**Consulta:** ${result.query}`,
    `**Data:** ${new Date(result.scrapedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    `**Total de anúncios analisados:** ${result.totalAds}`,
    ``,
    `### Estatísticas de Preço`,
    `| Métrica | Valor |`,
    `|---------|-------|`,
    `| Preço Mínimo | R$ ${result.minPrice.toLocaleString("pt-BR")} |`,
    `| Preço Médio | R$ ${result.avgPrice.toLocaleString("pt-BR")} |`,
    `| Preço Máximo | R$ ${result.maxPrice.toLocaleString("pt-BR")} |`,
    ``,
    `### Top Anúncios`,
    `| # | Título | Preço | Condição |`,
    `|---|--------|-------|----------|`,
  ];

  result.ads.forEach((ad, i) => {
    const title = ad.title.length > 50 ? ad.title.slice(0, 47) + "..." : ad.title;
    lines.push(
      `| ${i + 1} | ${title} | R$ ${ad.price.toLocaleString("pt-BR")} | ${ad.condition} |`
    );
  });

  lines.push(
    ``,
    `### Sugestão de Trade-in (margem 25%)`,
    `| Métrica | Valor |`,
    `|---------|-------|`,
    `| Preço médio mercado | R$ ${result.avgPrice.toLocaleString("pt-BR")} |`,
    `| Trade-in sugerido (75%) | R$ ${Math.round(result.avgPrice * 0.75).toLocaleString("pt-BR")} |`,
  );

  return lines.join("\n");
}

// ── Funções Internas ────────────────────────────────────────────────

function extractAdsFromResults(data: any): FirecrawlAd[] {
  const ads: FirecrawlAd[] = [];

  if (!data?.data || !Array.isArray(data.data)) {
    // Tenta formato alternativo
    if (data?.results && Array.isArray(data.results)) {
      return extractFromArray(data.results);
    }
    return ads;
  }

  return extractFromArray(data.data);
}

function extractFromArray(items: any[]): FirecrawlAd[] {
  const ads: FirecrawlAd[] = [];

  for (const item of items) {
    // Tenta extrair do campo json (formato Firecrawl scrape com JSON)
    const jsonData = item.json || item.extract || item.metadata || item;

    // Extrair preço do título/descrição se não vier no JSON estruturado
    let price = parseFloat(jsonData.price);
    if (isNaN(price) && item.markdown) {
      price = extractPriceFromText(item.markdown);
    }
    if (isNaN(price) && item.title) {
      price = extractPriceFromText(item.title);
    }
    if (isNaN(price) && jsonData.title) {
      price = extractPriceFromText(jsonData.title);
    }

    if (isNaN(price) || price <= 0) continue;

    ads.push({
      title: jsonData.title || item.title || item.url || "Sem título",
      price,
      link: jsonData.link || item.url || item.sourceURL || "",
      condition: jsonData.condition || "usado",
    });
  }

  return ads;
}

function extractPriceFromText(text: string): number {
  if (!text) return NaN;

  // Padrões: R$ 1.234,56 / R$1234 / 1.234,56
  const patterns = [
    /R\$\s*([\d.]+,\d{2})/,
    /R\$\s*([\d.]+)/,
    /([\d.]+,\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const cleaned = match[1]
        .replace(/\./g, "")
        .replace(",", ".");
      const value = parseFloat(cleaned);
      if (value > 50 && value < 50000) return value;
    }
  }

  return NaN;
}
