export interface AgentState {
  requisito: string;
  contextoAdicional?: string;
  planoDetalhado: string | null;
  planoAprovado: boolean;
  prompts: Record<string, string>;
  arquivosGerados: string[];
  relatorioValidacao: string | null;
  validacaoAprovada: boolean;
  branchName: string | null;
  commits: Array<{ arquivo: string; mensagem: string }>;
  prUrl: string | null;
  etapaAtual: 'planejamento' | 'implementacao' | 'revisao' | 'git' | 'concluido';
  aguardandoAprovacao: boolean;
}

export const initialState: AgentState = {
  requisito: '',
  planoDetalhado: null,
  planoAprovado: false,
  prompts: {},
  arquivosGerados: [],
  relatorioValidacao: null,
  validacaoAprovada: false,
  branchName: null,
  commits: [],
  prUrl: null,
  etapaAtual: 'planejamento',
  aguardandoAprovacao: false,
};
