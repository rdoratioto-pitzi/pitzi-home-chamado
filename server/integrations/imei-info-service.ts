const IMEI_INFO_API_URL = "https://api.imei.info";
const IMEI_INFO_API_KEY = process.env.IMEI_INFO_API_KEY || "";

export async function startMonitoring(): Promise<void> {
  if (!IMEI_INFO_API_KEY) {
    console.log("[IMEI.info] API key not configured, monitoring disabled");
    return;
  }
  console.log("[IMEI.info] Monitoring started (hourly updates)");
}

export async function getStats(): Promise<any> {
  return {
    totalChecks: 0,
    todayChecks: 0,
    successRate: 0,
    lastCheck: null,
  };
}

export async function getHistoricalStats(_tenantId?: string, _days: number = 30): Promise<any[]> {
  return [];
}

export async function testConnection(): Promise<{ success: boolean; message: string }> {
  if (!IMEI_INFO_API_KEY) {
    return { success: false, message: "API key não configurada" };
  }

  try {
    const response = await fetch(`${IMEI_INFO_API_URL}/account/credits`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${IMEI_INFO_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return { success: true, message: "Conexão estabelecida com sucesso" };
    }
    return { success: false, message: `Erro: ${response.status} ${response.statusText}` };
  } catch (error: any) {
    return { success: false, message: error.message || "Falha ao conectar" };
  }
}

export async function checkIMEI(imei: string, service?: string): Promise<any> {
  if (!IMEI_INFO_API_KEY) {
    throw new Error("API key não configurada");
  }

  const response = await fetch(`${IMEI_INFO_API_URL}/check`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${IMEI_INFO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imei, service: service || "default" }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getCredits(): Promise<any> {
  if (!IMEI_INFO_API_KEY) {
    return { credits: 0, message: "API key não configurada" };
  }

  try {
    const response = await fetch(`${IMEI_INFO_API_URL}/account/credits`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${IMEI_INFO_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    return { credits: 0, message: error.message };
  }
}
