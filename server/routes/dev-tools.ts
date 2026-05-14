import { Router } from "express";
import axios from "axios";

export function registerDevToolsRoutes(router: Router) {
  // Rota para executar SQL na API externa
  // Esta rota deve ser protegida ou oculta, usada apenas para desenvolvimento
  router.post("/api/dev/sql-execute", async (req, res) => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      // Configuração baseada no sql_api.postman_collection.json
      const externalApiUrl = "https://dash.pitzi.com.br/api/sql/execute";
      const token = "Renov123"; // Token de referência fornecido

      const response = await axios.post(
        externalApiUrl,
        { query },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // A API externa retorna os dados diretamente em JSON para SELECTs
      // ou o número de linhas afetadas para INSERT/UPDATE
      return res.json(response.data);
    } catch (error: any) {
      console.error("Error executing SQL:", error.message);
      
      if (error.response) {
        return res.status(error.response.status).json({ 
          error: "External API Error", 
          details: error.response.data 
        });
      }
      
      return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });

  // Rota para exportar SQL da API externa
  router.post("/api/dev/sql-export", async (req, res) => {
    try {
      const { query, format } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      // Configuração baseada no sql_api.postman_collection.json e no arquivo sql_api.py fornecido
      const externalApiUrl = "https://dash.pitzi.com.br/api/sql/export";
      const token = "Renov123"; // Token de referência fornecido

      const response = await axios.post(
        externalApiUrl,
        { query, format },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          responseType: "stream", // Importante para streaming de arquivos binários
        }
      );

      // Repassa o content-type e content-disposition da API externa
      res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
      if (response.headers["content-disposition"]) {
        res.setHeader("Content-Disposition", response.headers["content-disposition"]);
      } else {
         const ext = format === 'csv' ? 'csv' : 'xlsx';
         res.setHeader("Content-Disposition", `attachment; filename=export.${ext}`);
      }

      // Pipe do stream da API externa direto para a resposta do cliente
      response.data.pipe(res);

    } catch (error: any) {
      console.error("Error exporting SQL:", error.message);
      
      let errorDetails = "Unknown error";
      
      if (error.response) {
         // Tentar ler o stream de erro da API externa
         try {
             const stream = error.response.data;
             const chunks = [];
             for await (const chunk of stream) {
                 chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
             }
             errorDetails = Buffer.concat(chunks).toString('utf-8');
             console.error("External API Error details:", errorDetails);
             
             // Tentar parsear como JSON para retornar estruturado
             try {
                 const jsonError = JSON.parse(errorDetails);
                 return res.status(error.response.status).json(jsonError);
             } catch (e) {
                 // Se não for JSON válido, retorna como string em 'details'
                 return res.status(error.response.status).json({ 
                    error: "External API Error", 
                    details: errorDetails 
                 });
             }
         } catch (readError) {
             console.error("Failed to read error stream:", readError);
         }

        return res.status(error.response.status).json({ 
          error: "External API Error", 
          details: errorDetails
        });
      }
      
      return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });
}
