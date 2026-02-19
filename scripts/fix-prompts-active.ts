// Script para corrigir prompts existentes definindo is_active = true
import { db } from '../server/db';
import { promptsLibrary } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function fixPromptsActive() {
  console.log('\n=== CORRIGINDO PROMPTS ===\n');
  
  try {
    // Verificar status atual
    const before = await db.execute(sql`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN is_active = true THEN 1 END) as active_true,
             COUNT(CASE WHEN is_active = false THEN 1 END) as active_false
      FROM prompts_library
    `);
    console.log('Status antes:', before.rows[0]);
    
    // Atualizar todos para is_active = true
    const result = await db.execute(sql`
      UPDATE prompts_library
      SET is_active = true, updated_at = NOW()
      WHERE is_active = false
    `);
    console.log('Prompts atualizados:', result.rowCount);
    
    // Verificar status depois
    const after = await db.execute(sql`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN is_active = true THEN 1 END) as active_true,
             COUNT(CASE WHEN is_active = false THEN 1 END) as active_false
      FROM prompts_library
    `);
    console.log('Status depois:', after.rows[0]);
    
    console.log('\n✅ Correção concluída!\n');
  } catch (error) {
    console.error('Erro:', error);
  }
  
  process.exit(0);
}

fixPromptsActive();
