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
      const externalApiUrl = "https://dash.renovsmart.com.br/api/sql/execute";
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
}
