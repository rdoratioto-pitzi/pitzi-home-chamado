import { useState, useRef, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Printer, Search, Download, Loader2, CheckCircle, AlertCircle, Smartphone, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ==========================================
// 1. INTERFACES E REGRAS DE NEGÓCIO
// ==========================================
interface DeviceData {
  imei: string;
  deviceDescription: string;
  deviceErpCode: string;
  grading: string;
  triador: string;
  marca: string;
  statusRecebimento: string;
}

// CENTRALIZANDO A REGRA: Define o que aparece na etiqueta baseado no status
function getLabelDisplayConfig(device: DeviceData) {
  const status = device.statusRecebimento?.toLowerCase().trim() || "";
  const isTriado = status === "triado";

  return {
    isTriado,
    gradingText: isTriado ? device.grading : "\u00A0", // \u00A0 = espaço em branco (React/HTML)
    gradingZPL: isTriado ? device.grading : " ",      // espaço em branco (ZPL)
    codText: isTriado ? `Cód: ${device.deviceErpCode}` : "\u00A0",
    codZPL: isTriado ? `^FO30,180^A0N,28,28^FDCod: ${device.deviceErpCode}^FS` : ""
  };
}

// ==========================================
// 2. FUNÇÕES DE IMPRESSÃO E ZPL (Fora do React)
// ==========================================
function generateZPL(device: DeviceData): string {
  const { gradingZPL, codZPL } = getLabelDisplayConfig(device);
  const barcodeImei = device.imei.split("/")[0].trim();
  
  return `^XA
^CI28
^PW800
^LL400
^LH10,10
^FO600,20^A0N,80,80^FD${gradingZPL}^FS
^FO30,110^A0N,32,32^FB740,2,0,C,0^FD${device.deviceDescription}^FS
${codZPL}
^FO30,220^A0N,20,20^FDIMEI: ${device.imei}^FS
^FO30,250^A0N,20,20^FDTriador: ${device.triador}^FS
^FO150,290^BY2^BCN,70,Y,N,N^FD${barcodeImei}^FS
^XZ`;
}

function downloadZPL(zpl: string, imei: string) {
  const blob = new Blob([zpl], { type: "application/x-zpl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `etiqueta_${imei}.zpl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getHtmlForDirectPrint(device: DeviceData, primaryImei: string) {
  const { gradingText, codText } = getLabelDisplayConfig(device);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Etiqueta - ${primaryImei}</title>
      <style>
        @page { size: 100mm 50mm; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; width: 100mm; height: 50mm; background: white; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .label { width: 100mm; height: 50mm; display: flex; flex-direction: column; padding: 0.5mm; }
        .header-row { display: flex; width: 100%; height: 11mm; border-bottom: 0.5mm solid #000; }
        .description-box { flex: 1; padding: 1mm 2mm; font-weight: bold; font-size: 5mm; display: flex; align-items: center; line-height: 1.1; overflow: hidden; }
        .grading-box { width: 16mm; min-width: 16mm; background: black; color: white; display: flex; align-items: center; justify-content: center; font-size: 9mm; font-weight: bold; }
        .content-area { padding: 1.5mm 2mm 0 2mm; flex: 1; display: flex; flex-direction: column; }
        .info-line { font-size: 4mm; margin: 0.5mm 0; font-weight: bold; line-height: 1.2; }
        .barcode-area { margin-top: auto; display: flex; flex-direction: column; align-items: center; padding-bottom: 1mm; }
        .barcode-area img { max-height: 14mm; }
        .barcode-number { font-size: 4.5mm; font-weight: bold; letter-spacing: 0.3mm; }
      </style>
    </head>
    <body>
      <div class="label">
        <div class="header-row">
          <div class="description-box">${device.deviceDescription}</div>
          <div class="grading-box">${gradingText}</div>
        </div>
        <div class="content-area">
          <div class="info-line">Marca: ${device.marca}</div>
          <div class="info-line">${codText}</div>
          <div class="info-line">Triador: ${device.triador}</div>
          <div class="barcode-area">
            <img id="barcode-img" src="/api/etiquetas/barcode/${primaryImei}" alt="Barcode" />
            <div class="barcode-number">${primaryImei}</div>
          </div>
        </div>
      </div>
      <script>
        const img = document.getElementById('barcode-img');
        const doPrint = () => { window.print(); setTimeout(() => window.close(), 500); };
        img.complete ? doPrint() : (img.onload = doPrint, img.onerror = doPrint);
      </script>
    </body>
    </html>
  `;
}

// ==========================================
// 3. API DE BUSCA (Extraída para limpar o hook)
// ==========================================
async function fetchDeviceFromApi(searchTerm: string): Promise<DeviceData> {
  const isImei = /^\d{15}$/.test(searchTerm);
  const isVoucher = /^[A-Za-z]/.test(searchTerm) || /^[A-Za-z]{2,}/.test(searchTerm) || /^[0-9A-Fa-f]{8,}$/.test(searchTerm);
  
  const endpoint = (param: string, value: string) => `/api/integrations/adm-logistica/triagem?${param}=${encodeURIComponent(value)}`;
  
  let url = isImei ? endpoint("imei", searchTerm) : isVoucher ? endpoint("voucher_code", searchTerm) : endpoint("serial_number", searchTerm);
  
  let res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar dados de triagem");
  
  let data = await res.json();
  let list = Array.isArray(data) ? data : (data?.data || []);

  // Fallbacks
  if (list.length === 0 && (isImei || isVoucher)) {
    res = await fetch(endpoint("serial_number", searchTerm));
    if (res.ok) {
      data = await res.json();
      list = Array.isArray(data) ? data : (data?.data || []);
    }
  }

  if (list.length === 0) {
    const type = isImei ? "IMEI" : isVoucher ? "Voucher Code" : "Serial Number";
    throw new Error(`Nenhum dispositivo encontrado com este ${type}: ${searchTerm}`);
  }

  const tri = list[0];
  const imei1 = tri["IMEI"] || "";
  const imei2 = tri["IMEI2"] || "";
  const serial = tri["Serial Number"] || tri["Numero de Serie"] || tri["Serial"] || "";
  
  const primaryId = imei1 || serial || searchTerm;
  const codigoErp = tri["Código ERP"] || tri["Codigo ERP"] || "";
  const rawTriador = tri["Responsável pela triagem"] || tri["Responsavel pela triagem"];

  return {
    imei: imei2 ? `${primaryId} / ${imei2}` : primaryId,
    deviceDescription: (tri["Modelo"] || "DISPOSITIVO NÃO IDENTIFICADO").toUpperCase(),
    deviceErpCode: codigoErp || "—",
    grading: codigoErp.length >= 2 ? codigoErp.slice(-2) : "??",
    triador: rawTriador ? rawTriador.toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()) : "Aguardando Triagem",
    marca: (tri["Marca"] || "N/A").toUpperCase(),
    statusRecebimento: tri["Status de recebimento"] || tri["Status de Recebimento"] || tri["status_recebimento"] || ""
  };
}

// ==========================================
// 4. SUB-COMPONENTE: VISUAL DA ETIQUETA
// ==========================================
const LabelPreview = ({ device, barcodeUrl }: { device: DeviceData, barcodeUrl: string | null }) => {
  const { gradingText, codText } = getLabelDisplayConfig(device);

  return (
    <div className="bg-white mx-auto" style={{ width: "100mm", height: "50mm" }} data-testid="label-preview">
      <div className="bg-white flex flex-col overflow-hidden border border-gray-300" style={{ width: "100mm", height: "50mm", padding: "0.5mm" }}>
        
        <div className="flex" style={{ width: "100%", height: "11mm", borderBottom: "0.5mm solid #000" }}>
          <div className="flex-1 font-bold text-black flex items-center text-left overflow-hidden" style={{ padding: "1mm 2mm", fontSize: "5mm", lineHeight: "1.1" }}>
            {device.deviceDescription}
          </div>
          <div className="bg-black text-white flex items-center justify-center font-bold" style={{ width: "16mm", fontSize: "9mm" }}>
            {gradingText}
          </div>
        </div>

        <div className="flex-1 flex flex-col" style={{ padding: "1.5mm 2mm 0 2mm" }}>
          <div className="font-bold text-black text-left" style={{ fontSize: "4mm", margin: "0.5mm 0", lineHeight: "1.2" }}>Marca: {device.marca}</div>
          <div className="font-bold text-black text-left" style={{ fontSize: "4mm", margin: "0.5mm 0", lineHeight: "1.2" }}>{codText}</div>
          <div className="font-bold text-black text-left" style={{ fontSize: "4mm", margin: "0.5mm 0", lineHeight: "1.2" }}>Triador: {device.triador}</div>
          
          <div className="flex flex-col items-center mt-auto pb-[1mm]">
            {barcodeUrl ? (
              <>
                <img src={barcodeUrl} alt="Barcode" style={{ maxHeight: "14mm" }} />
                <div className="text-black font-bold" style={{ fontSize: "4.5mm", letterSpacing: "0.3mm" }}>
                  {device.imei.split("/")[0].trim()}
                </div>
              </>
            ) : (
              <div className="w-full bg-gray-100 animate-pulse rounded" style={{ height: "15mm" }} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// ==========================================
// 5. COMPONENTE PRINCIPAL (A TELA)
// ==========================================
export default function ImpressaoEtiquetasPage() {
  const { toast } = useToast();
  const [imei, setImei] = useState("");
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const imeiInputRef = useRef<HTMLInputElement>(null);

  const barcodeUrl = deviceData ? `/api/etiquetas/barcode/${deviceData.imei.split("/")[0].trim()}?t=${Date.now()}` : null;

  const closeLabelPopup = useCallback(() => {
    setShowPopup(false);
    imeiInputRef.current?.focus();
  }, []);

  const searchDeviceMutation = useMutation({
    mutationFn: fetchDeviceFromApi,
    onSuccess: (data) => {
      setDeviceData(data);
      setError(null);
      setShowPopup(true);
      toast({ title: "Dispositivo encontrado!" });
    },
    onError: (err: any) => {
      setError(err.message);
      setDeviceData(null);
      toast({ title: "Erro na busca", description: err.message, variant: "destructive" });
    },
  });

  const printMutation = useMutation({
    mutationFn: async () => {
      if (!deviceData) throw new Error("Dados incompletos");
      const validImei = deviceData.imei.split("/")[0].trim();
      
      const response = await apiRequest("POST", "/api/etiquetas/imprimir", {
        imei: validImei,
        deviceDescription: deviceData.deviceDescription,
        deviceErpCode: deviceData.deviceErpCode,
        triador: deviceData.triador,
      });
      return response.json();
    },
    onSuccess: () => {
      if (!deviceData) return;
      const primaryImei = deviceData.imei.split("/")[0].trim();
      const printWindow = window.open("", "_blank", "width=500,height=300");
      if (printWindow) {
        printWindow.document.write(getHtmlForDirectPrint(deviceData, primaryImei));
        printWindow.document.close();
      }
      toast({ title: "Enviando para impressora..." });
    },
    onError: (err: any) => toast({ title: "Erro ao gerar etiqueta", description: err.message, variant: "destructive" }),
  });

  const handleSearch = (term = imei) => {
    if (term.length < 3) return setError("Termo de busca muito curto.");
    setError(null);
    searchDeviceMutation.mutate(term);
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Impressão de Etiquetas"
        description="Gere etiquetas para triagem de dispositivos."
        breadcrumbs={[{ label: "Triagem", href: "/triagem/impressao-etiquetas" }, { label: "Impressão de Etiquetas" }]}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="max-w-lg mx-auto">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Printer className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Impressão de Etiquetas</CardTitle>
                  <CardDescription>Escaneie ou digite o IMEI, Serial Number ou Voucher Code</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="imei" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  IMEI do Dispositivo
                </Label>
                <div className="flex gap-2">
                  <Input
                    ref={imeiInputRef}
                    id="imei"
                    value={imei}
                    onChange={(e) => {
                      setImei(e.target.value);
                      if (/^\d{15}$/.test(e.target.value)) handleSearch(e.target.value);
                    }}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Digite ou escaneie o IMEI, Serial ou Voucher"
                    className="font-mono text-lg"
                  />
                  <Button onClick={() => handleSearch()} disabled={searchDeviceMutation.isPending || imei.length < 3}>
                    {searchDeviceMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">A etiqueta aparecerá automaticamente ao completar o IMEI (15 dígitos) ou pressione Enter.</p>
              </div>

              {error && (
                <Alert className="bg-red-500/5 border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-sm font-bold text-red-700">Erro</AlertTitle>
                  <AlertDescription className="text-xs text-red-600/80">{error}</AlertDescription>
                </Alert>
              )}

              {deviceData && !showPopup && (
                <>
                  <Separator />
                  <Button className="w-full gap-2" size="lg" onClick={() => setShowPopup(true)}>
                    <Printer className="h-4 w-4" /> Ver Etiqueta
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {showPopup && deviceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-[700px] w-full mx-4">
            <Button variant="ghost" size="icon" className="absolute top-3 right-3 z-10" onClick={closeLabelPopup}>
              <X className="h-6 w-6" />
            </Button>

            <LabelPreview device={deviceData} barcodeUrl={barcodeUrl} />

            <div className="flex gap-3 mt-6">
              <Button className="flex-1 gap-2" size="lg" onClick={() => printMutation.mutate()} disabled={printMutation.isPending}>
                {printMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Imprimir Etiqueta
              </Button>
              <Button variant="secondary" size="lg" onClick={() => {
                downloadZPL(generateZPL(deviceData), deviceData.imei);
                toast({ title: "Arquivo ZPL gerado!" });
              }}>
                <Download className="h-4 w-4" /> ZPL
              </Button>
              <Button variant="secondary" size="lg" onClick={closeLabelPopup}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}