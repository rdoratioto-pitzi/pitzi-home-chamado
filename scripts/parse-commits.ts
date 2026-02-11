import { storage } from "../server/storage";
import { execSync } from "child_process";

async function parseCommits() {
    console.log("🔍 Analisando últimos commits do Git...");

    try {
        // DESATIVADO TEMPORARIAMENTE PARA EVITAR ALTO USO DE CPU
        // const gitLog = execSync('git log -n 10 --pretty=format:"%h|%ai|%s"').toString();
        // const lines = gitLog.split("\n");

        // for (const line of lines) {
        //     const [hash, date, subject] = line.split("|");

        //     // Suggest based on conventional commit prefixes
        //     let category: 'feature' | 'bugfix' | 'improvement' | 'announcement' = 'improvement';
        //     if (subject.startsWith("feat")) category = 'feature';
        //     if (subject.startsWith("fix")) category = 'bugfix';

        //     console.log(`💡 Sugestão encontrada: [${category}] ${subject}`);

        //     // Check if already exists in updates (by title or hash in content)
        //     // This is a simplified version
        //     await storage.createUpdate({
        //         version: "v1.x.x", // Template to be filled
        //         title: subject,
        //         content: `Commit: ${hash}\nData: ${date}\n\nDetalhes da alteração...`,
        //         category,
        //         source: "Git",
        //         isPublished: false,
        //     });
        // }

        console.log("⚠️ Analisador de commits git desativado para preservação de CPU.");
    } catch (error) {
        console.error("❌ Erro ao ler histórico do Git:", error);
    }
}

parseCommits().catch(console.error);
