/**
 * Debug: fetch photos from RenovSmart API and show per-device breakdown
 * Usage: npx tsx scripts/debug-imei-fotos.ts [imei] [limit_date]
 */

const BASE_URL = "https://dash.renovsmart.com.br/api";
const TOKEN = process.env.RENOVSMART_API_TOKEN || "Renov123";

async function main() {
  const imeiFilter = process.argv[2] || null;
  const limitDate = process.argv[3] || new Date().toISOString().slice(0, 10);

  const url = `${BASE_URL}/avaliacoes-ia/imei?limit_date=${limitDate}`;
  console.log(`Fetching: ${url}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.error(`API error: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const data: any[] = await res.json();
  console.log(`Total raw photos: ${data.length}\n`);

  // Group by IMEI
  const grouped = new Map<string, any[]>();
  for (const item of data) {
    const imei = item.Imei || "";
    if (!imei) continue;
    if (imeiFilter && !imei.includes(imeiFilter)) continue;
    if (!grouped.has(imei)) grouped.set(imei, []);
    grouped.get(imei)!.push(item);
  }

  console.log(`Devices${imeiFilter ? ` matching "${imeiFilter}"` : ""}: ${grouped.size}\n`);

  // Show first 5 devices (or all if filtering by IMEI)
  const maxDevices = imeiFilter ? grouped.size : 5;
  let count = 0;

  for (const [imei, photos] of grouped) {
    if (count >= maxDevices) break;
    count++;

    const descs = photos.map((p: any) => p.Descricao_Captura || p["Descrição Captura"] || "(empty)");
    const hasTelaImei = descs.some((d: string) => d.toLowerCase().includes("tela") && d.toLowerCase().includes("imei"));
    const hasTraseira = descs.some((d: string) => d.toLowerCase().includes("traseira"));

    console.log(`━━━ IMEI: ${imei} (${photos.length} photos) ━━━`);
    console.log(`  Has "Tela com IMEI": ${hasTelaImei ? "✓" : "✗ MISSING"}`);
    console.log(`  Has "Parte Traseira": ${hasTraseira ? "✓" : "✗ MISSING"}`);

    for (const p of photos) {
      const desc = p.Descricao_Captura || p["Descrição Captura"] || "(empty)";
      const notaIa = p.Nota_IA || p["Nota IA"] || "-";
      const notaHum = p.Nota_Humana || p["Nota Humana"] || "-";
      const url = p.Url_Captura || p["Url Captura"] ? "YES" : "NULL";
      console.log(`  ${desc.padEnd(35)} IA=${notaIa} Hum=${notaHum} Url=${url}`);
    }
    console.log();
  }

  // Summary: count devices missing slot 1 / slot 3
  let missingTela = 0;
  let missingTraseira = 0;
  let total = 0;

  for (const [, photos] of grouped) {
    total++;
    const descs = photos.map((p: any) => (p.Descricao_Captura || p["Descrição Captura"] || "").toLowerCase());
    if (!descs.some((d: string) => d.includes("tela") && d.includes("imei"))) missingTela++;
    if (!descs.some((d: string) => d.includes("traseira"))) missingTraseira++;
  }

  console.log("━━━ SUMMARY ━━━");
  console.log(`Total devices: ${total}`);
  console.log(`Missing "Tela com IMEI": ${missingTela} (${((missingTela / total) * 100).toFixed(1)}%)`);
  console.log(`Missing "Parte Traseira": ${missingTraseira} (${((missingTraseira / total) * 100).toFixed(1)}%)`);
}

main().catch(console.error);
