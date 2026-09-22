// Fonte de verdade das aplicações Pitzi.
// NUNCA hard-codar valores em outro arquivo — sempre importar daqui.

export const APPLICATION_CATEGORIES = [
  "Stack IA",
  "Pitzi Smart (Backend)",
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
    repos: ["Pitzi-BD/Pitzi.Home"],
    defaultBranch: "develop",
  },
  "pitzi-hub": {
    key: "pitzi-hub",
    label: "Pitzi Hub",
    category: "Stack IA",
    repos: ["Pitzi-BD/Pitzi.Hub"],
    defaultBranch: "develop",
  },
  "venus": {
    key: "venus",
    label: "Venus",
    category: "Stack IA",
    repos: ["Pitzi-BD/venus"],
    defaultBranch: "main",
  },

  // Pitzi Smart (Backend)
  "pitzi-smart": {
    key: "pitzi-smart",
    label: "Pitzi Smart (RS)",
    category: "Pitzi Smart (Backend)",
    repos: [
      "Pitzi-BD/Pitzi.Api",
      "Pitzi-BD/Pitzi.Front",
      "Pitzi-BD/Pitzi.Infra",
      "Pitzi-BD/Pitzi.DataLake.Infra",
    ],
    defaultBranch: "main",
  },
  "pitzi-smart-api": {
    key: "pitzi-smart-api",
    label: "Pitzi API",
    category: "Pitzi Smart (Backend)",
    repos: ["Pitzi-BD/Pitzi.Api"],
    defaultBranch: "main",
  },
  "pitzi-smart-front": {
    key: "pitzi-smart-front",
    label: "Pitzi Front",
    category: "Pitzi Smart (Backend)",
    repos: ["Pitzi-BD/Pitzi.Front"],
    defaultBranch: "main",
  },
  "pitzi-smart-infra": {
    key: "pitzi-smart-infra",
    label: "Pitzi Infra",
    category: "Pitzi Smart (Backend)",
    repos: ["Pitzi-BD/Pitzi.Infra"],
    defaultBranch: "main",
  },
  "pitzi-smart-datalake": {
    key: "pitzi-smart-datalake",
    label: "Pitzi DataLake",
    category: "Pitzi Smart (Backend)",
    repos: ["Pitzi-BD/Pitzi.DataLake.Infra"],
    defaultBranch: "main",
  },

  // IA & Avaliação
  "pitzi-ia-backend": {
    key: "pitzi-ia-backend",
    label: "Pitzi IA Backend",
    category: "IA & Avaliação",
    repos: ["Pitzi-BD/PitziIA.BackEnd"],
    defaultBranch: "main",
  },
  "pitzi-ia-vc": {
    key: "pitzi-ia-vc",
    label: "Pitzi IA VC",
    category: "IA & Avaliação",
    repos: ["Pitzi-BD/PitziIA.VC"],
    defaultBranch: "main",
  },
  "pitzi-avaliador-macnotes": {
    key: "pitzi-avaliador-macnotes",
    label: "Avaliador MacNotes",
    category: "IA & Avaliação",
    repos: ["Pitzi-BD/Pitzi.AvaliadorMacNotes"],
    defaultBranch: "main",
  },

  // Dashboard & Site
  "dashboards": {
    key: "dashboards",
    label: "Dashboard",
    category: "Dashboard & Site",
    repos: ["Pitzi-BD/Dashboards"],
    defaultBranch: "main",
  },
  "pitzi-com-br": {
    key: "pitzi-com-br",
    label: "pitzi.com.br",
    category: "Dashboard & Site",
    repos: ["Pitzi-BD/pitzi.com.br"],
    defaultBranch: "main",
  },

  // Manutenção legada
  "pitzi-hubfront": {
    key: "pitzi-hubfront",
    label: "Pitzi HubFront",
    category: "Manutenção legada",
    repos: ["Pitzi-BD/Pitzi.HubFront"],
    defaultBranch: "main",
  },
  "pitzi-go-api": {
    key: "pitzi-go-api",
    label: "PitziGo API",
    category: "Manutenção legada",
    repos: ["Pitzi-BD/PitziGoAppleAPI"],
    defaultBranch: "main",
  },
  "pitzi-go-front": {
    key: "pitzi-go-front",
    label: "PitziGo Front",
    category: "Manutenção legada",
    repos: ["Pitzi-BD/PitziGoFront"],
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
