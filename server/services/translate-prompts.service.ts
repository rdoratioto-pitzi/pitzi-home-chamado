// Serviço de tradução de prompts para português do Brasil
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

interface PromptData {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
}

/**
 * Traduz um texto para português do Brasil
 * Usa Google Translate API gratuita
 */
async function translateText(text: string): Promise<string> {
  if (!text || text.trim() === '') return text;

  try {
    // Verificar se já foi traduzido (não traduzir strings curtas ou vazias)
    if (text.length < 20) {
      console.log(`   ⏭️  Pulo: ${text.substring(0, 30)}...`);
      return text;
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt-BR&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Translate API error: ${response.status}`);
    }

    const data = await response.json();

    // A API retorna um array onde o primeiro elemento é o array de traduções
    const translations = data[0] as string[][];

    if (translations && translations.length > 0) {
      return translations.map((t: string[]) => t[0]).join(' ');
    }

    return text;
  } catch (error) {
    console.warn(`⚠️  Erro ao traduzir texto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return text; // Retorna original se falhar
  }
}

/**
 * Traduz todos os campos de um prompt
 */
async function translatePromptFields(
  id: string,
  title: string,
  description: string,
  content: string,
  category: string
): Promise<PromptData> {
  console.log(`   Traduzindo: ${title}...`);

  const translatedTitle = await translateText(title);
  const translatedDescription = await translateText(description);
  const translatedContent = await translateText(content);

  return {
    id,
    title: translatedTitle,
    description: translatedDescription,
    content: translatedContent,
    category,
  };
}

/**
 * Traduz todos os prompts ativos
 */
export async function translateAllPrompts() {
  console.log('\n🌐 Iniciando tradução de prompts para português do Brasil...\n');

  try {
    // Buscar todos os prompts ativos
    const result = await pool.query(`
      SELECT id, title, description, content, category
      FROM prompts_library
      WHERE is_active = true
    `);

    const prompts: PromptData[] = result.rows;
    console.log(`📊 ${prompts.length} prompts encontrados para traduzir\n`);

    if (prompts.length === 0) {
      console.log('ℹ️  Nenhum prompt para traduzir.');
      return { success: true, total: 0, translated: 0, failed: 0 };
    }

    let translated = 0;
    let failed = 0;

    for (const prompt of prompts) {
      try {
        const translatedPrompt = await translatePromptFields(
          prompt.id,
          prompt.title,
          prompt.description,
          prompt.content,
          prompt.category
        );

        // Atualizar no banco
        await pool.query(`
          UPDATE prompts_library
          SET
            title = $1,
            description = $2,
            content = $3,
            is_translated = true,
            original_language = 'en',
            updated_at = NOW()
          WHERE id = $4
        `, [
          translatedPrompt.title,
          translatedPrompt.description,
          translatedPrompt.content,
          prompt.id
        ]);

        translated++;
        console.log(`   ✅ ${translatedPrompt.title.substring(0, 50)}...`);

      } catch (error) {
        failed++;
        console.error(`   ❌ Falha ao traduzir ${prompt.title}:`, error);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Tradução concluída!`);
    console.log(`   Sucesso: ${translated} prompts`);
    console.log(`   Falhas: ${failed} prompts`);
    console.log(`   Total: ${prompts.length} prompts`);
    console.log('='.repeat(50));

    return { success: true, total: prompts.length, translated, failed };

  } catch (error) {
    console.error('❌ Erro ao traduzir prompts:', error);
    return { success: false, total: 0, translated: 0, failed: 0 };
  } finally {
    await pool.end();
  }
}

/**
 * Verifica status da tradução
 */
export async function checkTranslationStatus() {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_translated THEN 1 ELSE 0 END) as translated,
        SUM(CASE WHEN NOT is_translated THEN 1 ELSE 0 END) as pending
      FROM prompts_library
      WHERE is_active = true
    `);

    const row = result.rows[0];
    console.log('\n📊 Status da tradução:');
    console.log(`   Total de prompts: ${row.total}`);
    console.log(`   Traduzidos: ${row.translated}`);
    console.log(`   Pendentes: ${row.pending}`);

    return {
      total: row.total,
      translated: row.translated,
      pending: row.pending,
      percent: row.total > 0 ? (row.translated / row.total) * 100 : 0
    };
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    return null;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  checkTranslationStatus().then(() => {
    console.log(`\n💡 Execute: node -e "import('./translate-prompts.service.ts').then(m => m.translateAllPrompts())"`);
  });
}
