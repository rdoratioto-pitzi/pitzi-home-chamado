import { storage } from "../server/storage";

async function test() {
  const startDate = new Date('2026-03-01T00:00:00.000Z');
  const endDate = new Date('2026-03-31T23:59:59.999Z');

  console.log('Querying period:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);

  const rows = await storage.getClaudeCodeUsageByPeriod(startDate, endDate);
  console.log('Rows returned:', rows.length);
  for (const r of rows) {
    console.log(' -', r.developerName, r.reportDate, typeof r.totalTokens, r.totalTokens);
  }

  const claudeByDev: Record<string, {tokens: number; spend: number; keysCount: number}> = {};
  for (const row of rows) {
    const key = row.developerName;
    if (!claudeByDev[key]) {
      claudeByDev[key] = { tokens: 0, spend: 0, keysCount: 1 };
    }
    claudeByDev[key].tokens += Number(row.totalTokens);
  }
  console.log('\nclaudeByDev:', JSON.stringify(claudeByDev, null, 2));
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
