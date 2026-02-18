import { storage } from "../server/storage";
import { execSync } from "child_process";

interface GitCommit {
    hash: string;
    date: string;
    subject: string;
    author: string;
    body: string;
}

function parseCategoryFromCommit(subject: string): 'feature' | 'bugfix' | 'improvement' | 'announcement' {
    const lowerSubject = subject.toLowerCase();
    
    // Conventional commits patterns
    if (lowerSubject.startsWith('feat') || lowerSubject.includes('✨') || lowerSubject.includes('nova') || lowerSubject.includes('novo')) {
        return 'feature';
    }
    if (lowerSubject.startsWith('fix') || lowerSubject.includes('🐛') || lowerSubject.includes('corrig') || lowerSubject.includes('ajust')) {
        return 'bugfix';
    }
    if (lowerSubject.startsWith('docs') || lowerSubject.includes('📚') || lowerSubject.includes('doc')) {
        return 'announcement';
    }
    if (lowerSubject.startsWith('refactor') || lowerSubject.includes('♻️') || lowerSubject.includes('melhor')) {
        return 'improvement';
    }
    if (lowerSubject.startsWith('perf') || lowerSubject.includes('⚡')) {
        return 'improvement';
    }
    if (lowerSubject.startsWith('chore') || lowerSubject.startsWith('build') || lowerSubject.includes('🔧')) {
        return 'improvement';
    }
    
    return 'improvement';
}

function generateReadableTitle(subject: string): string {
    // Remove conventional commit prefixes
    let title = subject.replace(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci|revert)(\([^)]+\))?:\s*/i, '');
    
    // Remove Replit specific prefixes
    title = title.replace(/^(Update|Add|Remove|Fix|Improve|Change)\s+/i, '');
    
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    // Truncate if too long
    if (title.length > 80) {
        title = title.substring(0, 77) + '...';
    }
    
    return title;
}

function simplifyDescription(subject: string, body: string): string {
    const descriptions: string[] = [];
    
    // Parse subject for keywords
    const lowerSubject = subject.toLowerCase();
    
    // Extract meaningful actions from subject
    if (lowerSubject.includes('sidebar') || lowerSubject.includes('menu')) {
        descriptions.push('• Melhorias na navegação e organização do menu lateral');
    }
    if (lowerSubject.includes('notification') || lowerSubject.includes('notifica')) {
        descriptions.push('• Novo sistema de notificações para acompanhar atualizações');
    }
    if (lowerSubject.includes('access') || lowerSubject.includes('permiss')) {
        descriptions.push('• Ajustes nos controles de acesso e permissões de usuários');
    }
    if (lowerSubject.includes('fix') || lowerSubject.includes('correct') || lowerSubject.includes('ajust')) {
        descriptions.push('• Correções e ajustes para melhor estabilidade');
    }
    if (lowerSubject.includes('page') || lowerSubject.includes('tela') || lowerSubject.includes('interface')) {
        descriptions.push('• Melhorias visuais e na experiência do usuário');
    }
    if (lowerSubject.includes('api') || lowerSubject.includes('endpoint') || lowerSubject.includes('route')) {
        descriptions.push('• Otimizações nos processos internos do sistema');
    }
    if (lowerSubject.includes('task') || lowerSubject.includes('tarefa')) {
        descriptions.push('• Novas funcionalidades no módulo de tarefas');
    }
    if (lowerSubject.includes('update') || lowerSubject.includes('atualiz')) {
        descriptions.push('• Atualização geral do sistema com melhorias diversas');
    }
    if (lowerSubject.includes('ticket') || lowerSubject.includes('chamado')) {
        descriptions.push('• Melhorias no gerenciamento de chamados');
    }
    if (lowerSubject.includes('filter') || lowerSubject.includes('filtro')) {
        descriptions.push('• Novos filtros para facilitar buscas');
    }
    if (lowerSubject.includes('dashboard') || lowerSubject.includes('painel')) {
        descriptions.push('• Melhorias no painel de controle');
    }
    if (lowerSubject.includes('login') || lowerSubject.includes('auth')) {
        descriptions.push('• Aprimoramentos na segurança e login do sistema');
    }
    if (lowerSubject.includes('deploy') || lowerSubject.includes('publish')) {
        descriptions.push('• Nova versão publicada com atualizações');
    }
    if (lowerSubject.includes('module') || lowerSubject.includes('módulo')) {
        descriptions.push('• Novo módulo adicionado ao sistema');
    }
    
    // If no specific keywords found, add generic description based on commit type
    if (descriptions.length === 0) {
        if (parseCategoryFromCommit(subject) === 'feature') {
            descriptions.push('• Nova funcionalidade implementada no sistema');
        } else if (parseCategoryFromCommit(subject) === 'bugfix') {
            descriptions.push('• Correção de problema identificado');
        } else {
            descriptions.push('• Melhorias e ajustes no funcionamento geral');
        }
    }
    
    // Add author info in friendly format
    descriptions.push(`\n👤 Desenvolvido pela equipe técnica`);
    
    return descriptions.join('\n');
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function extractVersionFromDate(dateStr: string): string {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `v${year}.${month}.${day}`;
}

async function parseCommits() {
    console.log("🔍 Analisando últimos commits do Git...");

    try {
        // Get last 20 commits with more details
        const gitLog = execSync('git log -n 20 --pretty=format:"%h|%ai|%s|%an|%b<END>"').toString();
        const commitBlocks = gitLog.split('<END>').filter(block => block.trim());
        
        console.log(`📊 Encontrados ${commitBlocks.length} commits para análise`);

        let newUpdatesCount = 0;
        let skippedCount = 0;

        for (const block of commitBlocks) {
            const lines = block.trim().split('\n');
            const header = lines[0];
            const body = lines.slice(1).join('\n').trim();
            
            const [hash, date, subject, author] = header.split('|');
            
            if (!hash || !subject) continue;

            // Skip Replit internal commits
            if (subject.includes('Replit-Commit') || 
                subject.includes('Checkpoint') ||
                subject.includes('Session-Id') ||
                body.includes('Replit-Commit') ||
                body.includes('Screenshot-Url')) {
                skippedCount++;
                continue;
            }

            const category = parseCategoryFromCommit(subject);
            const title = generateReadableTitle(subject);
            
            // Check if already exists
            const existingUpdates = await storage.getUpdates(undefined, true);
            const alreadyExists = existingUpdates.some(u => 
                u.title.toLowerCase() === title.toLowerCase() ||
                (u.source === 'Git' && u.content.includes(hash))
            );

            if (alreadyExists) {
                skippedCount++;
                continue;
            }

            // Create simplified, user-friendly content
            const content = simplifyDescription(subject, body);

            await storage.createUpdate({
                version: extractVersionFromDate(date),
                title: title,
                content: content,
                category: category,
                source: "Git",
                isPublished: true, // Sincronizados do Git são publicados automaticamente
            });

            console.log(`✅ Novidade criada: [${category}] ${title}`);
            newUpdatesCount++;
        }

        console.log(`\n📈 Resumo:`);
        console.log(`   • ${newUpdatesCount} novidades criadas`);
        console.log(`   • ${skippedCount} commits ignorados`);
        
        if (newUpdatesCount > 0) {
            console.log(`\n💡 Dica: Acesse o módulo "Novidades" para revisar e publicar as atualizações.`);
        }

    } catch (error) {
        console.error("❌ Erro ao ler histórico do Git:", error);
        console.log("⚠️ Certifique-se de que está executando este script na raiz do repositório Git.");
    }
}

// ES Module compatible check for direct execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
    parseCommits().catch(console.error);
}

export { parseCommits };
