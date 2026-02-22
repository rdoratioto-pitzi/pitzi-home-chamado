import { Router } from "express";
import { z } from "zod";

export function registerLabelRoutes(router: Router) {
  // ============== LABEL PRINTING (IMPRESSÃO DE ETIQUETAS) ==============

  // Zod schema for label data validation
  const labelDataSchema = z.object({
    imei: z.string().length(15).regex(/^\d{15}$/, "IMEI deve ter exatamente 15 dígitos numéricos"),
    deviceDescription: z.string().min(1).max(200),
    deviceErpCode: z.string().min(1).max(50),
    triador: z.string().min(1).max(100),
  });

  // Generate PNG label with Code128 barcode
  router.post("/api/etiquetas/gerar-png", async (req, res) => {
    try {
      const validationResult = labelDataSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Dados inválidos", details: validationResult.error.errors });
      }

      const { imei, deviceDescription, deviceErpCode, triador } = validationResult.data;
      const grading = deviceErpCode.length >= 2 ? deviceErpCode.slice(-2) : "??";

      // Return barcode as base64 along with label data
      const barcodeBase64 = ""; // Temporarily disable

      res.json({
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
    } catch (error: any) {
      console.error("Label generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate label" });
    }
  });

  // Generate ZPL for printing (client opens print window)
  router.post("/api/etiquetas/imprimir", async (req, res) => {
    try {
      const validationResult = labelDataSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Dados inválidos", details: validationResult.error.errors });
      }

      const { imei, deviceDescription, deviceErpCode, triador } = validationResult.data;

      const grading = deviceErpCode.length >= 2 ? deviceErpCode.slice(-2) : "??";

      // Generate ZPL code for Zebra printer
      const zpl = `^XA\r\n^CI28\r\n^PW800\r\n^LL400\r\n^LH10,10\r\n\r\n^FO600,20^A0N,80,80^FD${grading}^FS\r\n\r\n^FO30,110^A0N,32,32^FB740,2,0,C,0^FD${deviceDescription}^FS\r\n\r\n^FO30,180^A0N,28,28^FDCod: ${deviceErpCode}^FS\r\n\r\n^FO30,220^A0N,20,20^FDIMEI: ${imei}^FS\r\n\r\n^FO30,250^A0N,20,20^FDTriador: ${triador}^FS\r\n\r\n^FO150,290^BY2^BCN,70,Y,N,N^FD${imei}^FS\r\n\r\n^XZ`;

      // Return the ZPL for client-side printing (browser print window)
      res.json({
        success: true,
        zpl,
        message: "ZPL generated successfully."
      });
    } catch (error: any) {
      console.error("Print label error:", error);
      res.status(500).json({ error: error.message || "Failed to print label" });
    }
  });

  // Get barcode image only (for preview)
  router.get("/api/etiquetas/barcode/:imei", async (req, res) => {
    try {
      const { imei } = req.params;

      // Validate IMEI format
      if (!imei || !/^\d{15}$/.test(imei)) {
        return res.status(400).json({ error: "IMEI inválido. Deve ter exatamente 15 dígitos." });
      }

      res.set("Content-Type", "image/png");
      res.send(""); // Temporarily disable
    } catch (error: any) {
      console.error("Barcode generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate barcode" });
    }
  });
}
