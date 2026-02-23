import { Router } from "express";
import { registerAuthRoutes } from "./auth";
import { registerUserRoutes } from "./users";
import { registerShipmentRoutes } from "./shipments";
import { registerTicketRoutes } from "./tickets";
import { registerProjectRoutes } from "./projects";
import { registerOkrRoutes } from "./okrs";
import { registerTaskRoutes } from "./tasks";
import { registerKnowledgeBaseRoutes } from "./knowledge";
import { registerAIRoutes } from "./ai";
import { registerNotificationRoutes } from "./notifications";
import { registerSettingsRoutes } from "./settings";
import { registerSlaRoutes } from "./slas";
import { registerCepRoutes } from "./cep";
import { registerIntegrationRoutes } from "./integrations";
import { registerLabelRoutes } from "./labels";
import { registerPricingRoutes } from "./pricing";
import { registerUpdateRoutes } from "./updates";
import { registerGitAnalyticsRoutes } from "./git-analytics";

export function registerModularRoutes(app: Router) {
  const router = Router();
  
  registerAuthRoutes(router);
  registerUserRoutes(router);
  registerShipmentRoutes(router);
  registerTicketRoutes(router);
  registerProjectRoutes(router);
  registerOkrRoutes(router);
  registerTaskRoutes(router);
  registerKnowledgeBaseRoutes(router);
  registerAIRoutes(router);
  registerNotificationRoutes(router);
  registerSettingsRoutes(router);
  registerSlaRoutes(router);
  registerCepRoutes(router);
  registerIntegrationRoutes(router);
  registerLabelRoutes(router);
  registerPricingRoutes(router);
  registerUpdateRoutes(router);
  registerGitAnalyticsRoutes(router);
  
  app.use(router);
}
