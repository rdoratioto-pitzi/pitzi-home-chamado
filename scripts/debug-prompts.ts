// Script para debugar prompts no banco de dados
import { db } from '../server/db';
import { promptsLibrary } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function debugPrompts() {
  console.log('\n=== DEBUG PROMPTS ===\n');
  
  try {
    // 1. Contar total de prompts
    const countResult = await db.execute(sql`SELECT COUNT(*) as total FROM prompts_library`);
    console.log('1. Total de prompts no banco:', countResult.rows[0]);
    
    // 2. Verificar campos is_active
    const activeStatus = await db.execute(sql`
      SELECT is_active, COUNT(*) as count 
      FROM prompts_library 
      GROUP BY is_active
    `);
    console.log('\n2. Status de is_active:', activeStatus.rows);
    
    // 3. Buscar todos sem filtro
    const allPrompts = await db.select().from(promptsLibrary);
    console.log('\n3. Total sem filtros:', allPrompts.length);
    
    // 4. Buscar apenas ativos com SQL direto
    const activePrompts = await db.execute(sql`
      SELECT id, title, category, is_active 
      FROM prompts_library 
      WHERE is_active = true 
      LIMIT 5
    `);
    console.log('\n4. Primeiros 5 prompts ativos (SQL direto):', activePrompts.rows);
    
    // 5. Buscar com Drizzle onde is_active = true
    const drizzleActive = await db.select({
      id: promptsLibrary.id,
      title: promptsLibrary.title,
      isActive: promptsLibrary.isActive
    })
    .from(promptsLibrary)
    .where(sql`${promptsLibrary.isActive} = true`)
    .limit(5);
    console.log('\n5. Primeiros 5 prompts ativos (Drizzle):', drizzleActive);
    
    // 6. Verificar se existe algum prompt
    if (allPrompts.length > 0) {
      console.log('\n6. Primeiro prompt do banco:', {
        id: allPrompts[0].id,
        title: allPrompts[0].title,
        category: allPrompts[0].category,
        isActive: allPrompts[0].isActive,
        isActiveType: typeof allPrompts[0].isActive
      });
    }
    
  } catch (error) {
    console.error('Erro no debug:', error);
  }
  
  process.exit(0);
}

debugPrompts();
