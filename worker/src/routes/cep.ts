// worker/src/routes/cep.ts
import { Hono } from "hono";
import type { AppEnv } from "../index";

const cep = new Hono<AppEnv>();

// GET /api/cep/:cep (public)
cep.get("/api/cep/:cep", async (c) => {
  const cepNum = c.req.param("cep").replace(/\D/g, "");
  const response = await fetch(`https://viacep.com.br/ws/${cepNum}/json/`);
  const data: any = await response.json();

  if (data.erro) {
    return c.json({ error: "CEP not found" }, 404);
  }

  return c.json({
    cep: data.cep,
    logradouro: data.logradouro,
    bairro: data.bairro,
    cidade: data.localidade,
    uf: data.uf,
    ddd: data.ddd,
  });
});

// GET /api/cep/:cep/cobertura (public)
cep.get("/api/cep/:cep/cobertura", async (c) => {
  const cepNum = c.req.param("cep").replace(/\D/g, "");
  if (cepNum.length !== 8) {
    return c.json({ coberto: false, erro: "CEP deve ter 8 dígitos" }, 400);
  }

  const viacepResponse = await fetch(`https://viacep.com.br/ws/${cepNum}/json/`);
  const viacepData: any = await viacepResponse.json();

  if (viacepData.erro) {
    return c.json({ coberto: false, erro: "CEP não encontrado. Verifique o número informado." });
  }

  const cepDestino = "04575020";

  try {
    const correiosCalcUrl = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?nCdEmpresa=&sDsSenha=&nCdServico=04510&sCepOrigem=${cepNum}&sCepDestino=${cepDestino}&nVlPeso=1&nCdFormato=1&nVlComprimento=20&nVlAltura=10&nVlLargura=15&nVlDiametro=0&sCdMaoPropria=N&nVlValorDeclarado=0&sCdAvisoRecebimento=N&StrRetorno=xml`;

    const correiosResponse = await fetch(correiosCalcUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (correiosResponse.ok) {
      const xmlText = await correiosResponse.text();

      const hasError =
        xmlText.includes("<Erro>") &&
        !xmlText.includes("<Erro>0</Erro>") &&
        !xmlText.includes("<Erro></Erro>");
      const errorMatch = xmlText.match(/<MsgErro>(.*?)<\/MsgErro>/);
      const cepNotCovered =
        errorMatch?.[1]?.toLowerCase().includes("não atend") ||
        errorMatch?.[1]?.toLowerCase().includes("localidade") ||
        (xmlText.includes("CEP de origem") && xmlText.includes("inválido"));

      if (hasError && cepNotCovered) {
        return c.json({
          coberto: false,
          erro: `CEP ${cepNum} não possui cobertura dos Correios para serviços de entrega/coleta. ${errorMatch?.[1] || ""}`.trim(),
        });
      }
    }
  } catch {
    console.log("CEP coverage calc check unavailable, falling back to ViaCEP validation");
  }

  return c.json({
    coberto: true,
    cidade: viacepData.localidade,
    uf: viacepData.uf,
    mensagem: `CEP ${cepNum} está na área de cobertura dos Correios.`,
  });
});

export { cep };
