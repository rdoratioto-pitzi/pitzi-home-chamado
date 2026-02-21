import { StateGraph, END } from '@langchain/langgraph';
import { AgentState } from './types/agent-state';
import { atlas } from './agents/atlas';
import { turing } from './agents/turing';
import { giter } from './agents/giter';

export async function createOrchestrator() {
  const workflow = new StateGraph({ channels: {
    requisito: { value: (x, y) => y ?? x, default: () => '' },
    planoDetalhado: { value: (x, y) => y ?? x, default: () => null },
    planoAprovado: { value: (x, y) => y ?? x, default: () => false },
    etapaAtual: { value: (x, y) => y ?? x, default: () => 'planejamento' },
    aguardandoAprovacao: { value: (x, y) => y ?? x, default: () => false },
    device: { value: (x, y) => y ?? x, default: () => 'unknown' },
  }});
  workflow.addNode('atlas', atlas);
  workflow.setEntryPoint('atlas');
  workflow.addEdge('atlas', END);
  return workflow.compile();
}

export async function createQAGitWorkflow() {
  const workflow = new StateGraph({ channels: {
    requisito: { value: (x, y) => y ?? x, default: () => '' },
    relatorioQA: { value: (x, y) => y ?? x, default: () => null },
    qaAprovado: { value: (x, y) => y ?? x, default: () => false },
    branchName: { value: (x, y) => y ?? x, default: () => null },
    etapaAtual: { value: (x, y) => y ?? x, default: () => 'qa' },
  }});
  workflow.addNode('turing', turing);
  workflow.addNode('giter', giter);
  workflow.setEntryPoint('turing');
  workflow.addConditionalEdges('turing', (s) => s.qaAprovado ? 'giter' : 'fim', { giter: 'giter', fim: END });
  workflow.addEdge('giter', END);
  return workflow.compile();
}
