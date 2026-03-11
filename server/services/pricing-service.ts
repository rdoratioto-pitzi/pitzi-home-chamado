
/**
 * Pricing Service - Versão Simplificada
 * 
 * Usa apenas o cache da API externa (RenovSmart), como na aplicação de referência.
 * A lógica de 7 dias é gerenciada pela API externa.
 * 
 * Fluxo:
 * 1. Receber lista de dispositivos elegíveis da API externa
 * 2. Para cada dispositivo, chamar /search com ignoreLastUpdateDate=false
 * 3. A API externa decide se retorna do cache ou faz novo scraping
 * 4. Retornar produtos + preços para o frontend
 */

const RENOVSMART_API_BASE = "https://rp.renovsmart.com.br/api";

export interface EligibleDevice {
  categoryId: string;
  manufacturerName: string;
  modelName: string;
  storage: number;
}

export interface ScrapedPrice {
  id: string;
  rawId: string;
  productId: string;
  productUrl: string;
  title: string;
  source: string;
  priceText: string;
  extractedPrice: number;
  rating?: number;
  reviews?: number;
  thumbnail: string;
}

export interface SearchResponse {
  rawId: string;
  fromCache: boolean;
  searchedAt: string;
  prices: ScrapedPrice[];
}

export interface DeviceWithPrices {
  device: EligibleDevice;
  fromCache: boolean;
  scrapedAt: Date;
  scrapedData: ScrapedPrice[];
}

/**
 * Busca dispositivos elegíveis da API externa
 */
export async function fetchEligibleDevices(
  categoryId: string, 
  pageNumber: number = 1, 
  pageSize: number = 200
): Promise<EligibleDevice[]> {
  try {
    const params = new URLSearchParams();
    params.append("categoryId", categoryId);
    params.append("pageNumber", String(pageNumber));
    params.append("pageSize", String(pageSize));

    const url = `${RENOVSMART_API_BASE}/eligible-devices?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch eligible devices: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // Filtrar dispositivos Xiaomi e Redmi (igual ao proxy existente)
    if (data.items && Array.isArray(data.items)) {
      return data.items.filter((item: any) => {
        const brand = (item.manufacturerName || "").toUpperCase();
        return !brand.includes("XIAOMI") && !brand.includes("XIOMI") && !brand.includes("REDMI");
      });
    }

    return [];
  } catch (error) {
    console.error("Error fetching eligible devices:", error);
    return [];
  }
}

/**
 * Realiza o scraping de preços para um dispositivo específico
 * A API externa gerencia o cache de 7 dias internamente
 */
export async function scrapeDevicePrices(
  categoryId: string,
  manufacturer: string,
  model: string,
  storage: number,
  forceRefresh: boolean = false
): Promise<SearchResponse | null> {
  try {
    const params = new URLSearchParams();
    params.append("categoryId", categoryId);
    params.append("manufacturer", manufacturer);
    params.append("model", model);
    params.append("storage", String(storage));
    params.append("ignoreLastUpdateDate", String(forceRefresh));

    const url = `${RENOVSMART_API_BASE}/search?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to scrape device prices: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data as SearchResponse;
  } catch (error) {
    console.error("Error scraping device prices:", error);
    return null;
  }
}

/**
 * Processa lista de dispositivos elegíveis
 * Para cada dispositivo, faz chamada à API externa (que gerencia o cache de 7 dias)
 */
export async function processEligibleDevices(
  categoryId: string,
  devices: EligibleDevice[]
): Promise<DeviceWithPrices[]> {
  const results: DeviceWithPrices[] = [];
  
  for (const device of devices) {
    const scrapeResult = await scrapeDevicePrices(
      device.categoryId,
      device.manufacturerName,
      device.modelName,
      device.storage,
      false // ignoreLastUpdateDate=false = usa cache da API se < 7 dias
    );

    if (scrapeResult) {
      results.push({
        device,
        fromCache: scrapeResult.fromCache,
        scrapedAt: new Date(scrapeResult.searchedAt),
        scrapedData: scrapeResult.prices,
      });
    } else {
      // Se falhou, retorna vazio mas mantém o dispositivo
      results.push({
        device,
        fromCache: false,
        scrapedAt: new Date(),
        scrapedData: [],
      });
    }
  }

  return results;
}

/**
 * Processa um único dispositivo (para uso sob demanda)
 */
export async function processSingleDevice(
  categoryId: string,
  manufacturer: string,
  model: string,
  storage: number,
  forceRefresh: boolean = false
): Promise<DeviceWithPrices | null> {
  const device: EligibleDevice = {
    categoryId,
    manufacturerName: manufacturer,
    modelName: model,
    storage,
  };

  const scrapeResult = await scrapeDevicePrices(
    categoryId,
    manufacturer,
    model,
    storage,
    forceRefresh
  );

  if (!scrapeResult) {
    return null;
  }

  return {
    device,
    fromCache: scrapeResult.fromCache,
    scrapedAt: new Date(scrapeResult.searchedAt),
    scrapedData: scrapeResult.prices,
  };
}
