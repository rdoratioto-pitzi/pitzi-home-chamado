#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { zeusAgent } from '../server/ai/agents/zeus';
import { db } from '../server/db';
import { aiModels } from '../shared/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('renov-dev')
  .description('🤖 AI Dev System - Automação de desenvolvimento')
  .version('2.0.0');

// COMANDO: run
program
  .command('run <planPath>')
  .description('Executar um plan')
  .option('-m, --model <nome>', 'Modelo a usar', 'Minimax M2.5')
  .option('--dry-run', 'Simular sem executar')
  .action(async (planPath: string, options: any) => {
    console.log('\n🤖 Renov AI Dev System V2\n');
    
    try {
      const fullPath = path.resolve(planPath);
      
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Plan não encontrado: ${fullPath}`);
        process.exit(1);
      }
      
      console.log(`📋 Plan: ${fullPath}`);
      console.log(`🤖 Modelo: ${options.model}`);
      
      if (options.dryRun) {
        console.log('\n🔍 Modo dry-run\n');
        console.log('✅ Plan válido!');
        process.exit(0);
      }
      
      console.log('\n⚡ Iniciando execução...\n');
      
      const result = await zeusAgent.executePlan({
        planPath: fullPath,
        modeloNome: options.model,
        userId: 1,
        userEmail: 'matheus@renovsmart.com.br',
      });
      
      if (result.success) {
        console.log('\n✅ Sucesso!\n');
        console.log(`⏱️  Tempo: ${result.tempoTotal}s`);
        console.log(`💰 Custo: $${result.custoTotal.toFixed(2)}`);
        console.log(`📁 Arquivos: ${result.arquivosModificados.length}`);
      } else {
        console.error('\n❌ Falhou\n');
        process.exit(1);
      }
      
    } catch (error: any) {
      console.error('\n❌ Erro:', error.message);
      process.exit(1);
    }
  });

// COMANDO: models
program
  .command('models')
  .description('Listar modelos disponíveis')
  .action(async () => {
    console.log('\n🤖 Modelos Disponíveis:\n');
    
    if (!db) {
      console.error('❌ Database não conectado');
      process.exit(1);
    }
    
    const modelos = await db.query.aiModels.findMany({
      where: eq(aiModels.ativo, true),
    });
    
    modelos.forEach((m, i) => {
      console.log(`${i + 1}. ${m.nome}`);
      console.log(`   ${m.provider} - $${m.custoInputPorMm}/M\n`);
    });
  });

program.parse();
