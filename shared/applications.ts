// Fonte de verdade das aplicações Renov.
// NUNCA hard-codar valores em outro arquivo — sempre importar daqui.

export const APPLICATION_CATEGORIES = [
  "Stack IA",
  "Renov Smart (Backend)",
  "IA & Avaliação",
  "Dashboard & Site",
  "Manutenção legada",
  "Pitzi",
] as const;

export type ApplicationCategory = (typeof APPLICATION_CATEGORIES)[number];

export interface Application {
  key: string;
  label: string;
  category: ApplicationCategory;
  repos: string[];
  defaultBranch: string;
}

export const APPLICATIONS: Record<string, Application> = {
  // Stack IA
  "pitzi-home": {
    key: "pitzi-home",
    label: "Pitzi Home",
    category: "Stack IA",
    repos: ["Renov-BD/Renov.Home"],
    defaultBranch: "develop",
  },
  "renov-hub": {
    key: "renov-hub",
    label: "Renov Hub",
    category: "Stack IA",
    repos: ["Renov-BD/Renov.Hub"],
    defaultBranch: "develop",
  },
  "venus": {
    key: "venus",
    label: "Venus",
    category: "Stack IA",
    repos: ["Renov-BD/venus"],
    defaultBranch: "main",
  },

  // Renov Smart (Backend)
  "renov-smart": {
    key: "renov-smart",
    label: "Renov Smart (RS)",
    category: "Renov Smart (Backend)",
    repos: [
      "Renov-BD/Pitzi.Api",
      "Renov-BD/Pitzi.Front",
      "Renov-BD/Pitzi.Infra",
      "Renov-BD/Pitzi.DataLake.Infra",
    ],
    defaultBranch: "main",
  },
  "renov-smart-api": {
    key: "renov-smart-api",
    label: "Pitzi API",
    category: "Renov Smart (Backend)",
    repos: ["Renov-BD/Pitzi.Api"],
    defaultBranch: "main",
  },
  "renov-smart-front": {
    key: "renov-smart-front",
    label: "Pitzi Front",
    category: "Renov Smart (Backend)",
    repos: ["Renov-BD/Pitzi.Front"],
    defaultBranch: "main",
  },
  "renov-smart-infra": {
    key: "renov-smart-infra",
    label: "Pitzi Infra",
    category: "Renov Smart (Backend)",
    repos: ["Renov-BD/Pitzi.Infra"],
    defaultBranch: "main",
  },
  "renov-smart-datalake": {
    key: "renov-smart-datalake",
    label: "Pitzi DataLake",
    category: "Renov Smart (Backend)",
    repos: ["Renov-BD/Pitzi.DataLake.Infra"],
    defaultBranch: "main",
  },

  // IA & Avaliação
  "renov-ia-backend": {
    key: "renov-ia-backend",
    label: "Renov IA Backend",
    category: "IA & Avaliação",
    repos: ["Renov-BD/RenovIA.BackEnd"],
    defaultBranch: "main",
  },
  "renov-ia-vc": {
    key: "renov-ia-vc",
    label: "Renov IA VC",
    category: "IA & Avaliação",
    repos: ["Renov-BD/RenovIA.VC"],
    defaultBranch: "main",
  },
  "renov-avaliador-macnotes": {
    key: "renov-avaliador-macnotes",
    label: "Avaliador MacNotes",
    category: "IA & Avaliação",
    repos: ["Renov-BD/Renov.AvaliadorMacNotes"],
    defaultBranch: "main",
  },

  // Dashboard & Site
  "dashboards": {
    key: "dashboards",
    label: "Dashboard",
    category: "Dashboard & Site",
    repos: ["Renov-BD/Dashboards"],
    defaultBranch: "main",
  },
  "pitzi-com-br": {
    key: "pitzi-com-br",
    label: "pitzi.com.br",
    category: "Dashboard & Site",
    repos: ["Renov-BD/pitzi.com.br"],
    defaultBranch: "main",
  },

  // Manutenção legada
  "renov-hubfront": {
    key: "renov-hubfront",
    label: "Renov HubFront",
    category: "Manutenção legada",
    repos: ["Renov-BD/Renov.HubFront"],
    defaultBranch: "main",
  },
  "renov-go-api": {
    key: "renov-go-api",
    label: "RenovGo API",
    category: "Manutenção legada",
    repos: ["Renov-BD/RenovGoAppleAPI"],
    defaultBranch: "main",
  },
  "renov-go-front": {
    key: "renov-go-front",
    label: "RenovGo Front",
    category: "Manutenção legada",
    repos: ["Renov-BD/RenovGoFront"],
    defaultBranch: "main",
  },

  // Pitzi
  "pitzi-duda": {
    key: "pitzi-duda",
    label: "Pitzi/Duda",
    category: "Pitzi",
    repos: ["Pitzi/duda"],
    defaultBranch: "main",
  },
};

export const getApplicationsByCategory = (): Record<ApplicationCategory, Application[]> => {
  const grouped = {} as Record<ApplicationCategory, Application[]>;
  for (const cat of APPLICATION_CATEGORIES) grouped[cat] = [];
  for (const app of Object.values(APPLICATIONS)) {
    grouped[app.category].push(app);
  }
  return grouped;
};

export const getApplicationLabel = (key: string | null | undefined): string => {
  if (!key) return "—";
  return APPLICATIONS[key]?.label ?? key;
};

export const isValidApplicationKey = (key: unknown): key is string => {
  return typeof key === "string" && key in APPLICATIONS;
};
