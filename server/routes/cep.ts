import { Router } from "express";

export function registerCepRoutes(router: Router) {
  // ============== CEP LOOKUP ==============
  router.get("/api/cep/:cep", async (req, res) => {
    try {
      const cep = req.params.cep.replace(/\D/g, "");
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        return res.status(404).json({ error: "CEP not found" });
      }

      res.json({
        cep: data.cep,
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
        ddd: data.ddd,
      });
    } catch (error) {
      console.error("CEP lookup error:", error);
      res.status(500).json({ error: "Failed to lookup CEP" });
    }
  });

  // ============== CEP COVERAGE VALIDATION ==============
  router.get("/api/cep/:cep/cobertura", async (req, res) => {
    try {
      const cep = req.params.cep.replace(/\D/g, "");
      if (cep.length !== 8) {
        return res.status(400).json({ coberto: false, erro: "CEP deve ter 8 dígitos" });
      }

      const viacepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const viacepData = await viacepResponse.json();

      if (viacepData.erro) {
        return res.json({ coberto: false, erro: "CEP não encontrado. Verifique o número informado." });
      }

      const cepDestino = "04575020";

      try {
        const correiosCalcUrl = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?nCdEmpresa=&sDsSenha=&nCdServico=04510&sCepOrigem=${cep}&sCepDestino=${cepDestino}&nVlPeso=1&nCdFormato=1&nVlComprimento=20&nVlAltura=10&nVlLargura=15&nVlDiametro=0&sCdMaoPropria=N&nVlValorDeclarado=0&sCdAvisoRecebimento=N&StrRetorno=xml`;

        const correiosResponse = await fetch(correiosCalcUrl, {
          signal: AbortSignal.timeout(8000),
        });

        if (correiosResponse.ok) {
          const xmlText = await correiosResponse.text();

          const hasError = xmlText.includes('<Erro>') && !xmlText.includes('<Erro>0</Erro>') && !xmlText.includes('<Erro></Erro>');
          const errorMatch = xmlText.match(/<MsgErro>(.*?)<\/MsgErro>/);
          const cepNotCovered = errorMatch?.[1]?.toLowerCase().includes('não atend') ||
            errorMatch?.[1]?.toLowerCase().includes('localidade') ||
            xmlText.includes('CEP de origem') && xmlText.includes('inválido');

          if (hasError && cepNotCovered) {
            return res.json({
              coberto: false,
              erro: `CEP ${cep} não possui cobertura dos Correios para serviços de entrega/coleta. ${errorMatch?.[1] || ''}`.trim(),
            });
          }
        }
      } catch (calcError) {
        console.log("CEP coverage calc check unavailable, falling back to ViaCEP validation");
      }

      res.json({
        coberto: true,
        cidade: viacepData.localidade,
        uf: viacepData.uf,
        mensagem: `CEP ${cep} está na área de cobertura dos Correios.`
      });
    } catch (error: any) {
      console.error("CEP coverage check error:", error);
      res.status(500).json({ coberto: false, erro: "Falha ao verificar cobertura do CEP" });
    }
  });
}
