// worker/src/routes/labels.ts
import { Hono } from "hono";
import { z } from "zod";
import * as bwipjs from "bwip-js";
import type { AppEnv } from "../index";

const labels = new Hono<AppEnv>();

const labelDataSchema = z.object({
  imei: z.string().min(1).max(50),
  deviceDescription: z.string().min(1).max(200),
  deviceErpCode: z.string().min(1).max(50),
  triador: z.string().min(1).max(100),
});

async function generateBarcodeBuffer(imei: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: imei,
    scale: 2,
    height: 6,
    includetext: false,
    textxalign: "center",
  });
}

// POST /api/etiquetas/gerar-png (public)
labels.post("/api/etiquetas/gerar-png", async (c) => {
  const result = labelDataSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json({ error: "Dados inválidos", details: result.error.errors }, 400);
  }

  const { imei, deviceDescription, deviceErpCode, triador } = result.data;
  const grading = deviceErpCode.length >= 2 ? deviceErpCode.slice(-2) : "??";

  const pngBuffer = await generateBarcodeBuffer(imei);
  const barcodeBase64 = pngBuffer.toString("base64");

  return c.json({
    success: true,
    label: {
      imei,
      deviceDescription,
      deviceErpCode,
      grading,
      triador,
      barcodeBase64: `data:image/png;base64,${barcodeBase64}`,
    },
  });
});

// POST /api/etiquetas/imprimir (public)
labels.post("/api/etiquetas/imprimir", async (c) => {
  const result = labelDataSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json({ error: "Dados inválidos", details: result.error.errors }, 400);
  }

  const { imei, deviceDescription, deviceErpCode, triador } = result.data;
  const grading = deviceErpCode.length >= 2 ? deviceErpCode.slice(-2) : "??";

  const zpl = `^XA\r\n^CI28\r\n^PW800\r\n^LL400\r\n^LH10,10\r\n\r\n^FO600,20^A0N,80,80^FD${grading}^FS\r\n\r\n^FO30,110^A0N,32,32^FB740,2,0,C,0^FD${deviceDescription}^FS\r\n\r\n^FO30,180^A0N,28,28^FDCod: ${deviceErpCode}^FS\r\n\r\n^FO30,220^A0N,20,20^FDIMEI: ${imei}^FS\r\n\r\n^FO30,250^A0N,20,20^FDTriador: ${triador}^FS\r\n\r\n^FO150,290^BY2^BCN,70,Y,N,N^FD${imei}^FS\r\n\r\n^XZ`;

  return c.json({ success: true, zpl, message: "ZPL generated successfully." });
});

// GET /api/etiquetas/barcode/:imei (public)
labels.get("/api/etiquetas/barcode/:imei", async (c) => {
  const imei = c.req.param("imei");

  if (!imei || imei.length < 1 || imei.length > 50) {
    return c.json({ error: "Código inválido. Deve ter entre 1 e 50 caracteres." }, 400);
  }

  const pngBuffer = await bwipjs.toBuffer({
    bcid: "code128",
    text: imei,
    scale: 2,
    height: 8,
    includetext: false,
    textxalign: "center",
  });

  return new Response(pngBuffer, {
    headers: { "Content-Type": "image/png" },
  });
});

export { labels };
