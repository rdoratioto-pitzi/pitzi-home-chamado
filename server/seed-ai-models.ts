import { db } from './db';
import * as schema from '../shared/schema';

async function seedAiModels() {
  if (!db) throw new Error("Database not connected");
  
  console.log('🌱 Seeding AI models...');

  const models = [
    {
      nome: 'Minimax M2.5',
      provider: 'openrouter',
      modelId: 'minimax/minimax-01',
      custoInputPorMm: '0.50',
      custoOutputPorMm: '0.50',
      config: { temperature: 0, max_tokens: 8192 },
      ativo: true,
    },
    {
      nome: 'DeepSeek R1',
      provider: 'openrouter',
      modelId: 'deepseek/deepseek-r1',
      custoInputPorMm: '0.55',
      custoOutputPorMm: '0.55',
      config: { temperature: 0, max_tokens: 8192 },
      ativo: true,
    },
    {
      nome: 'Claude Sonnet 4',
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      custoInputPorMm: '3.00',
      custoOutputPorMm: '15.00',
      config: { temperature: 0, max_tokens: 8192 },
      ativo: true,
    },
    {
      nome: 'Gemini Flash 2',
      provider: 'openrouter',
      modelId: 'google/gemini-flash-2.0',
      custoInputPorMm: '0.075',
      custoOutputPorMm: '0.30',
      config: { temperature: 0, max_tokens: 8192 },
      ativo: true,
    },
  ];

  for (const model of models) {
    try {
      // @ts-ignore
      await db.insert(schema.aiModels).values(model).onConflictDoNothing();
      console.log(`✅ ${model.nome}`);
    } catch (error) {
      console.log(`⚠️  ${model.nome}:`, error.message);
    }
  }

  console.log('✅ Seed completo!');
  process.exit(0);
}

seedAiModels();
