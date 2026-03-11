import { useState, useRef, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  Printer, 
  Search, 
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Smartphone,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface DeviceData {
  imei: string;
  deviceDescription: string;
  deviceErpCode: string;
  grading: string;
  triador: string;
  marca: string;
}

function generateZPL(deviceData: DeviceData): string {
  const { imei, deviceDescription, deviceErpCode, triador } = deviceData;
  const grading = deviceErpCode.length >= 2 ? deviceErpCode.slice(-2) : "??";
  const barcodeImei = imei.split("/")[0].trim();
  
  const zpl = `^XA
^CI28
^PW800
^LL400
^LH10,10

^FO600,20^A0N,80,80^FD${grading}^FS

^FO30,110^A0N,32,32^FB740,2,0,C,0^FD${deviceDescription}^FS

^FO30,180^A0N,28,28^FDCod: ${deviceErpCode}^FS

^FO30,220^A0N,20,20^FDIMEI: ${imei}^FS

^FO30,250^A0N,20,20^FDTriador: ${triador}^FS

^FO150,290^BY2^BCN,70,Y,N,N^FD${barcodeImei}^FS

^XZ`;
  
  return zpl;
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

export default function ImpressaoEtiquetasPage() {
  const { toast } = useToast();
  const [imei, setImei] = useState("");
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const imeiInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (deviceData?.imei) {
      const primaryImei = deviceData.imei.split("/")[0].trim();
      setBarcodeUrl(`/api/etiquetas/barcode/${primaryImei}?t=${Date.now()}`);
    } else {
      setBarcodeUrl(null);
    }
  }, [deviceData?.imei]);

  const openLabelPopup = useCallback(() => {
    if (deviceData) {
      setShowPopup(true);
    }
  }, [deviceData]);

  const closeLabelPopup = useCallback(() => {
    setShowPopup(false);
    imeiInputRef.current?.focus();
  }, []);

  const resetAndClose = useCallback(() => {
    setShowPopup(false);
    setDeviceData(null);
    setImei("");
    setBarcodeUrl(null);
    imeiInputRef.current?.focus();
  }, []);

  const searchDeviceMutation = useMutation({
    mutationFn: async (searchImei: string) => {
      const [recebimentosRes, triagemRes] = await Promise.all([
        fetch(`/api/integrations/adm-logistica/recebimentos?imei=${searchImei}`),
        fetch(`/api/integrations/adm-logistica/triagem?imei=${searchImei}`),
      ]);

      if (!recebimentosRes.ok) {
        throw new Error("Falha ao buscar dados de recebimentos");
      }

      const recebimentosData = await recebimentosRes.json();
      const triagemData = triagemRes.ok ? await triagemRes.json() : [];

      return { recebimentos: recebimentosData, triagem: triagemData };
    },
    onSuccess: ({ recebimentos, triagem }) => {
      const recList = Array.isArray(recebimentos) ? recebimentos : (recebimentos?.data || []);
      const triList = Array.isArray(triagem) ? triagem : (triagem?.data || []);

      if (recList && recList.length > 0) {
        const rec = recList[0];

        const modelo = rec["Modelo"] || "";
        const marca = rec["Marca"] || "";
        const codigoErp = rec["Código ERP"] || rec["Codigo ERP"] || "";
        const imei1 = rec["IMEI"] || imei;
        const imei2 = rec["IMEI2"] || "";

        let displayImei = imei1;
        if (imei2 && imei2.trim() !== "") {
          displayImei = `${imei1} / ${imei2}`;
        }

        let grading = "??";
        if (codigoErp && codigoErp.length >= 2) {
          grading = codigoErp.slice(-2);
        }

        let triador = "Aguardando Triagem";
        if (triList && triList.length > 0) {
          const tri = triList[0];
          const rawTriador = tri["Responsável pela triagem"] || tri["Responsavel pela triagem"];
          if (rawTriador && rawTriador.trim() !== "") {
            triador = rawTriador
              .toLowerCase()
              .split(" ")
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");
          }
        }

        const newDeviceData: DeviceData = {
          imei: displayImei,
          deviceDescription: modelo.toUpperCase() || "DISPOSITIVO NÃO IDENTIFICADO",
          deviceErpCode: codigoErp || "—",
          grading: grading,
          triador: triador,
          marca: marca.toUpperCase() || "N/A",
        };
        setDeviceData(newDeviceData);
        setError(null);
        setShowPopup(true);
        toast({ title: "Dispositivo encontrado!" });
      } else {
        setError("Nenhum dispositivo encontrado com este IMEI");
        setDeviceData(null);
      }
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao buscar dispositivo");
      setDeviceData(null);
      toast({
        title: "Erro na busca",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const getLabelCSS = () => `
    @page {
      size: 100mm 50mm;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      width: 100mm; 
      height: 50mm; 
      background: white;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .label { 
      width: 100mm; 
      height: 50mm; 
      background: white; 
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 0.5mm;
    }
    .header-row {
      display: flex;
      width: 100%;
      height: 11mm;
      min-height: 11mm;
      max-height: 11mm;
      border-bottom: 0.5mm solid #000;
    }
    .description-box {
      flex: 1;
      padding: 1mm 2mm;
      font-weight: bold;
      font-size: 5mm;
      display: flex;
      align-items: center;
      text-align: left;
      overflow: hidden;
      line-height: 1.1;
    }
    .grading-box {
      width: 16mm;
      min-width: 16mm;
      background: black;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9mm;
      font-weight: bold;
    }
    .content-area {
      padding: 1.5mm 2mm 0 2mm;
      flex: 1;
      display: flex;
      flex-direction: column;
      width: 100%;
    }
    .info-line { 
      text-align: left; 
      font-size: 4mm; 
      margin: 0.5mm 0; 
      font-weight: bold; 
      color: #000;
      line-height: 1.2;
      width: 100%;
    }
    .barcode-area { 
      margin-top: auto;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-bottom: 1mm;
    }
    .barcode-area img {
      width: auto;
      height: auto;
      max-height: 14mm;
    }
    .barcode-number {
      font-size: 4.5mm;
      font-weight: bold;
      color: #000;
      margin-top: 0mm;
      letter-spacing: 0.3mm;
    }
  `;

  const getLabelHTML = (data: DeviceData, imei: string) => `
    <div class="label">
      <div class="header-row">
        <div class="description-box">${data.deviceDescription}</div>
        <div class="grading-box">${data.grading}</div>
      </div>
      <div class="content-area">
        <div class="info-line">Marca: ${data.marca}</div>
        <div class="info-line">Cód: ${data.deviceErpCode}</div>
        <div class="info-line">Triador: ${data.triador}</div>
        <div class="barcode-area">
          <img id="barcode-img" src="/api/etiquetas/barcode/${imei}" alt="Barcode" />
          <div class="barcode-number">${imei}</div>
        </div>
      </div>
    </div>
  `;

  const triggerDirectPrint = useCallback(() => {
    if (!deviceData) return;
    const primaryImei = deviceData.imei.split("/")[0].trim();

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - ${primaryImei}</title>
        <style>${getLabelCSS()}</style>
      </head>
      <body>
        ${getLabelHTML(deviceData, primaryImei)}
        <script>
          const img = document.getElementById('barcode-img');
          function doPrint() {
            window.print();
            setTimeout(() => window.close(), 500);
          }
          if (img.complete) {
            doPrint();
          } else {
            img.onload = doPrint;
            img.onerror = doPrint;
          }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=500,height=300");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  }, [deviceData]);

  const printMutation = useMutation({
    mutationFn: async () => {
      if (!deviceData) throw new Error("Dados incompletos");
      
      // Extract primary IMEI to satisfy validation (15 digits)
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
      triggerDirectPrint();
      toast({ title: "Enviando para impressora..." });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao gerar etiqueta",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = (searchImei?: string) => {
    const imeiToSearch = searchImei || imei;
    if (!imeiToSearch || imeiToSearch.length !== 15 || !/^\d{15}$/.test(imeiToSearch)) {
      setError("IMEI inválido. Deve conter exatamente 15 dígitos numéricos.");
      return;
    }
    
    setError(null);
    searchDeviceMutation.mutate(imeiToSearch);
  };

  const handleDownload = () => {
    if (!deviceData) {
      toast({
        title: "Dados incompletos",
        description: "Busque o dispositivo antes de gerar a etiqueta.",
        variant: "destructive",
      });
      return;
    }

    const zpl = generateZPL(deviceData);
    downloadZPL(zpl, deviceData.imei);
    toast({ title: "Arquivo ZPL gerado com sucesso!" });
  };

  const handlePrint = () => {
    if (!deviceData) {
      toast({
        title: "Dados incompletos",
        description: "Busque o dispositivo antes de imprimir.",
        variant: "destructive",
      });
      return;
    }
    printMutation.mutate();
  };

  const handleImeiChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, "").slice(0, 15);
    setImei(cleanValue);
    if (cleanValue.length === 15) {
      handleSearch(cleanValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Impressão de Etiquetas" 
        description="Gere etiquetas para triagem de dispositivos."
        breadcrumbs={[
          { label: "Logística", href: "/logistica/dashboard" },
          { label: "Impressão de Etiquetas" }
        ]}
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
                  <CardDescription>Escaneie ou digite o IMEI do dispositivo</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="imei" className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    IMEI do Dispositivo
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      ref={imeiInputRef}
                      id="imei"
                      value={imei}
                      onChange={(e) => handleImeiChange(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Digite ou escaneie o IMEI (15 dígitos)"
                      maxLength={15}
                      className="font-mono text-lg"
                      data-testid="input-imei"
                    />
                    <Button 
                      onClick={() => handleSearch()}
                      disabled={searchDeviceMutation.isPending || imei.length !== 15}
                      data-testid="button-buscar"
                    >
                      {searchDeviceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {imei.length}/15 dígitos — A etiqueta aparecerá automaticamente ao completar o IMEI
                  </p>
                </div>
              </div>

              {error && (
                <Alert className="bg-red-500/5 border-red-500/20">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-sm font-bold text-red-700">Erro</AlertTitle>
                  <AlertDescription className="text-xs text-red-600/80">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {deviceData && !showPopup && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Dispositivo: {deviceData.deviceDescription}</span>
                  </div>
                  <Button 
                    className="w-full gap-2" 
                    size="lg"
                    onClick={openLabelPopup}
                    data-testid="button-abrir-popup"
                  >
                    <Printer className="h-4 w-4" />
                    Ver Etiqueta
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {showPopup && deviceData && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          data-testid="label-popup-overlay"
        >
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-[700px] w-full mx-4">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-10"
              onClick={closeLabelPopup}
              data-testid="button-fechar-popup"
            >
              <X className="h-6 w-6" />
            </Button>

            <div 
              className="bg-white mx-auto"
              style={{ width: "100mm", height: "50mm" }}
              data-testid="label-preview"
            >
              <div 
                className="bg-white flex flex-col overflow-hidden border border-gray-300"
                style={{ width: "100mm", height: "50mm", padding: "0.5mm" }}
              >
                <div className="flex" style={{ width: "100%", height: "11mm", minHeight: "11mm", maxHeight: "11mm", borderBottom: "0.5mm solid #000" }}>
                  <div className="flex-1 font-bold text-black flex items-center text-left overflow-hidden" style={{ padding: "1mm 2mm", fontSize: "5mm", lineHeight: "1.1" }}>
                    {deviceData.deviceDescription}
                  </div>
                  <div className="bg-black text-white flex items-center justify-center font-bold" style={{ width: "16mm", minWidth: "16mm", fontSize: "9mm" }}>
                    {deviceData.grading}
                  </div>
                </div>

                <div className="flex-1 flex flex-col" style={{ padding: "1.5mm 2mm 0 2mm", width: "100%" }}>
                  <div className="font-bold text-black text-left" style={{ fontSize: "4mm", margin: "0.5mm 0", lineHeight: "1.2", width: "100%" }}>Marca: {deviceData.marca}</div>
                  <div className="font-bold text-black text-left" style={{ fontSize: "4mm", margin: "0.5mm 0", lineHeight: "1.2", width: "100%" }}>Cód: {deviceData.deviceErpCode}</div>
                  <div className="font-bold text-black text-left" style={{ fontSize: "4mm", margin: "0.5mm 0", lineHeight: "1.2", width: "100%" }}>Triador: {deviceData.triador}</div>
                  
                  <div className="flex flex-col items-center w-full mt-auto" style={{ paddingBottom: "1mm" }}>
                    {barcodeUrl ? (
                      <>
                        <img 
                          src={barcodeUrl} 
                          alt={`Barcode ${deviceData.imei}`}
                          style={{ width: "100%", height: "auto", maxHeight: "14mm" }}
                          data-testid="barcode-image"
                        />
                        <div className="text-black font-bold" style={{ fontSize: "4.5mm", marginTop: "0mm", letterSpacing: "0.3mm" }}>
                          {deviceData.imei.split("/")[0].trim()}
                        </div>
                      </>
                    ) : (
                      <div className="w-full bg-gray-100 animate-pulse rounded" style={{ height: "15mm" }} />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button 
                className="flex-1 gap-2" 
                size="lg"
                onClick={handlePrint}
                disabled={printMutation.isPending}
                data-testid="button-imprimir"
              >
                {printMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Imprimir Etiqueta
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleDownload}
                data-testid="button-download-zpl"
              >
                <Download className="h-4 w-4" />
                ZPL
              </Button>
              <Button 
                variant="secondary"
                size="lg"
                onClick={closeLabelPopup}
                data-testid="button-fechar"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
