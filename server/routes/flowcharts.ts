import { Router, type Request } from "express";
import { storage } from "../storage";
import { getSessionUser, requireAuth } from "../middleware/auth";

export function registerFlowchartRoutes(router: Router) {
  const getId = (req: Request) => req.params.id as string;

  // ============== FLUXOGRAMAS ==============
  
  // GET /api/flowcharts - Listar fluxogramas do usuário
  router.get("/api/flowcharts", requireAuth, async (req, res) => {
    try {
      const { userId, isAdmin } = getSessionUser(req);
      const source = req.query.source as string | undefined;

      // Buscar todos os fluxogramas não-templates
      // O usuário deve ver: seus próprios + públicos + compartilhados com ele
      const allFlowcharts = await storage.getFlowcharts(undefined, source);
      
      // Filtrar para mostrar apenas:
      // 1. Fluxogramas do usuário atual (ownerId)
      // 2. Fluxogramas públicos (visibility = 'public')
      // 3. Fluxogramas compartilhados com o usuário
      const filteredFlowcharts = allFlowcharts.filter(fc => {
        // Seus próprios fluxogramas
        if (fc.ownerId === userId) return true;
        
        // Fluxogramas públicos
        if (fc.visibility === 'public') return true;
        
        // Fluxogramas compartilhados (se compartilhado com o usuário)
        if (fc.permissions) {
          try {
            const perms = JSON.parse(fc.permissions);
            if (perms[userId]) return true;
          } catch {}
        }
        
        return false;
      });
      
      res.json(filteredFlowcharts);
    } catch (error: any) {
      console.error("Erro ao buscar fluxogramas:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/flowcharts/templates - Listar templates
  router.get("/api/flowcharts/templates", requireAuth, async (req, res) => {
    try {
      const templates = await storage.getFlowchartTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Erro ao buscar templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/flowcharts/:id - Buscar fluxograma específico
  router.get("/api/flowcharts/:id", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const flowchart = await storage.getFlowchart(getId(req));
      
      if (!flowchart) {
        return res.status(404).json({ error: "Fluxograma não encontrado" });
      }
      
      // Verificar acesso: owner, público, ou compartilhado
      const hasAccess = 
        flowchart.ownerId === userId ||
        flowchart.visibility === 'public' ||
        (flowchart.permissions && JSON.parse(flowchart.permissions)[userId]);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Acesso negado" });
      }
      
      res.json(flowchart);
    } catch (error: any) {
      console.error("Erro ao buscar fluxograma:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/flowcharts - Criar fluxograma
  router.post("/api/flowcharts", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const { title, description, visibility, nodesData, edgesData, viewport, tenantId, source } = req.body;

      const newFlowchart = await storage.createFlowchart({
        title,
        description,
        visibility: visibility || 'private',
        ownerId: userId,
        tenantId: tenantId || null,
        nodesData: nodesData || null,
        edgesData: edgesData || null,
        viewport: viewport || null,
        isTemplate: false,
        source: source || 'reactflow',
      });
      
      res.status(201).json(newFlowchart);
    } catch (error: any) {
      console.error("Erro ao criar fluxograma:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PATCH /api/flowcharts/:id - Atualizar fluxograma
  router.patch("/api/flowcharts/:id", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const id = getId(req);
      const flowchart = await storage.getFlowchart(id);
      
      if (!flowchart) {
        return res.status(404).json({ error: "Fluxograma não encontrado" });
      }
      
      // Apenas o owner pode atualizar
      if (flowchart.ownerId !== userId) {
        return res.status(403).json({ error: "Apenas o dono pode editar" });
      }
      
      const updated = await storage.updateFlowchart(id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Erro ao atualizar fluxograma:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/flowcharts/:id - Deletar fluxograma
  router.delete("/api/flowcharts/:id", requireAuth, async (req, res) => {
    try {
      const { userId } = getSessionUser(req);
      const id = getId(req);
      const flowchart = await storage.getFlowchart(id);
      
      if (!flowchart) {
        return res.status(404).json({ error: "Fluxograma não encontrado" });
      }
      
      // Apenas o owner pode deletar
      if (flowchart.ownerId !== userId) {
        return res.status(403).json({ error: "Apenas o dono pode excluir" });
      }
      
      await storage.deleteFlowchart(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar fluxograma:", error);
      res.status(500).json({ error: error.message });
    }
  });

}
