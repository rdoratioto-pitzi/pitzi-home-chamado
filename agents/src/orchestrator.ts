import { StateGraph, END } from '@langchain/langgraph';
import { AgentState, initialState } from './types/agent-state';
import { atlas } from './agents/atlas';
import { neo } from './agents/neo';
import { ada } from './agents/ada';

export async function createOrchestrator() {
  const workflow = new StateGraph<AgentState>({
    channels: {
      requisito: { value: (x: string, y?: string) => y ?? x, default: () => '' },
      contextoAdicional: { value: (x: string | undefined, y?: string) => y ?? x },
      planoDetalhado: { value: (x: string | null, y?: string | null) => y ?? x, default: () => null },
      planoAprovado: { value: (x: boolean, y?: boolean) => y ?? x, default: () => false },
      prompts: { value: (x: Record<string, string>, y?: Record<string, string>) => ({ ...x, ...y }), default: () => ({}) },
      arquivosGerados: { value: (x: string[], y?: string[]) => y ?? x, default: () => [] },
      relatorioValidacao: { value: (x: string | null, y?: string | null) => y ?? x, default: () => null },
      validacaoAprovada: { value: (x: boolean, y?: boolean) => y ?? x, default: () => false },
      branchName: { value: (x: string | null, y?: string | null) => y ?? x, default: () => null },
      commits: { value: (x: any[], y?: any[]) => y ?? x, default: () => [] },
      prUrl: { value: (x: string | null, y?: string | null) => y ?? x, default: () => null },
      etapaAtual: { value: (x: string, y?: string) => y ?? x, default: () => 'planejamento' },
      aguardandoAprovacao: { value: (x: boolean, y?: boolean) => y ?? x, default: () => false },
    }
  });

  workflow.addNode('atlas', atlas);
  workflow.addNode('neo', neo);
  workflow.addNode('ada', ada);

  workflow.setEntryPoint('atlas');
  
  workflow.addConditionalEdges(
    'atlas',
    (state) => state.planoAprovado ? 'neo' : 'aguardar',
    { neo: 'neo', aguardar: END }
  );

  workflow.addEdge('neo', 'ada');
  
  workflow.addConditionalEdges(
    'ada',
    (state) => state.validacaoAprovada ? 'concluido' : 'aguardar',
    { concluido: END, aguardar: END }
  );

  return workflow.compile();
}
