import { useState, useRef } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Printer, 
  Search, 
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
  User,
  Smartphone,
  Tag,
  Barcode
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface DeviceData {
  imei: string;
  deviceDescription: string;
  deviceErpCode: string;
  grading: string;
}

const TRIADORES = [
  { value: "Livia", label: "Livia" },
  { value: "Fabricio", label: "Fabricio" },
  { value: "Bryan", label: "Bryan" },
];


function generateZPL(deviceData: DeviceData, triador: string): string {
  const { imei, deviceDescription, deviceErpCode } = deviceData;
  
  // Grading is the penultimate character, and we also want the last character
  const grading = deviceErpCode.length >= 2 ? deviceErpCode.slice(-2) : "??";
  
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

^FO150,290^BY2^BCN,70,Y,N,N^FD${imei}^FS

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
  const [triador, setTriador] = useState("");
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imeiInputRef = useRef<HTMLInputElement>(null);

  const searchDeviceMutation = useMutation({
    mutationFn: async (searchImei: string) => {
      const response = await fetch(`/api/integrations/rs-logistica/orders/advanced?imei=${searchImei}`);
      if (!response.ok) {
        throw new Error("Falha ao buscar dados do dispositivo");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const orders = Array.isArray(data) ? data : (data?.data || []);
      
      if (orders && orders.length > 0) {
        const order = orders[0];
        
        const modelName = order.ModelName || order.modelName || order.model_name || "";
        const storage = order.Storage || order.storage || "";
        const color = order.Color || order.color || "";
        const deviceDescription = [modelName, storage ? `${storage}GB` : "", color].filter(Boolean).join(" ") || "Dispositivo não identificado";
        
        const erpCode = order.DeviceErpCode || order.device_erp_code || order.deviceErpCode || order.SKU || "XXXXX00";
        // Get both grading (penultimate) and last character
        const grading = erpCode.length >= 2 ? erpCode.slice(-2) : "??";
        
        setDeviceData({
          imei: imei,
          deviceDescription: deviceDescription.toUpperCase(),
          deviceErpCode: erpCode,
          grading: grading,
        });
        setError(null);
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
    if (!deviceData || !triador) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um triador e busque o dispositivo antes de gerar a etiqueta.",
        variant: "destructive",
      });
      return;
    }

    const zpl = generateZPL(deviceData, triador);
    downloadZPL(zpl, deviceData.imei);
    toast({ title: "Arquivo ZPL gerado com sucesso!" });
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
        description="Gere etiquetas ZPL para triagem de dispositivos."
        breadcrumbs={[
          { label: "Logística", href: "/logistica/dashboard" },
          { label: "Impressão de Etiquetas" }
        ]}
      />

      <main className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Printer className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Dados da Etiqueta</CardTitle>
                  <CardDescription>Insira o IMEI para buscar as informações</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="triador" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Triador
                  </Label>
                  <Select value={triador} onValueChange={setTriador}>
                    <SelectTrigger id="triador" data-testid="select-triador">
                      <SelectValue placeholder="Selecione o triador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIADORES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                      className="font-mono"
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
                    {imei.length}/15 dígitos
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

              {deviceData && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Dispositivo Encontrado</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                        <Label className="text-xs text-muted-foreground">Descrição</Label>
                        <p className="font-medium text-sm mt-1">{deviceData.deviceDescription}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                          <Label className="text-xs text-muted-foreground">Código ERP</Label>
                          <p className="font-mono text-sm mt-1">{deviceData.deviceErpCode}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                          <Label className="text-xs text-muted-foreground">Grading</Label>
                          <p className="font-bold text-2xl mt-1 text-green-700">{deviceData.grading}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full gap-2" 
                    size="lg"
                    onClick={handleDownload}
                    disabled={!triador}
                    data-testid="button-download-zpl"
                  >
                    <Download className="h-4 w-4" />
                    Baixar Etiqueta ZPL
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Preview da Etiqueta</CardTitle>
                  <CardDescription>Visualização do layout (10x5cm)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                className="mx-auto border-2 border-dashed border-border rounded-lg bg-white px-6 py-3 relative"
                style={{ width: "380px", height: "200px" }}
              >
                {deviceData ? (
                  <div className="h-full flex flex-col">
                    {/* Grading - Top Right */}
                    <div className="absolute top-2 right-4">
                      <span className="text-4xl font-bold text-[#00A137]">
                        {deviceData.grading}
                      </span>
                    </div>

                    {/* Device Description - Centered */}
                    <div className="text-center mt-6 mb-1">
                      <p className="font-bold text-base text-black leading-tight">
                        {deviceData.deviceDescription}
                      </p>
                    </div>

                    {/* ERP Code - Centered */}
                    <div className="text-center mb-2">
                      <span className="text-xs text-gray-600">Cód: </span>
                      <span className="text-xs font-bold text-black">
                        {deviceData.deviceErpCode}
                      </span>
                    </div>

                    {/* IMEI and Triador - Left aligned */}
                    <div className="text-xs text-black space-y-0.5 mb-2">
                      <p><span className="text-gray-500">IMEI:</span> {deviceData.imei}</p>
                      <p><span className="text-gray-500">Triador:</span> {triador || "—"}</p>
                    </div>

                    {/* Barcode - Centered at bottom */}
                    <div className="flex flex-col items-center mt-auto">
                      <div className="flex items-end justify-center gap-px" style={{ height: "32px" }}>
                        {deviceData.imei.split("").map((digit, i) => {
                          const d = parseInt(digit) || 0;
                          return (
                            <div 
                              key={i}
                              className="bg-black"
                              style={{ 
                                width: i % 3 === 0 ? "2px" : "1px",
                                height: `${18 + d * 1.4}px`
                              }}
                            />
                          );
                        })}
                      </div>
                      <p className="text-[10px] font-mono mt-1 text-black tracking-wider">{deviceData.imei}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Barcode className="h-12 w-12 mb-2 opacity-30" />
                    <p className="text-sm">Insira um IMEI para visualizar</p>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border/40">
                <p className="text-xs text-muted-foreground">
                  <strong>Dimensões:</strong> 10 x 5 cm (Largura x Altura)<br />
                  <strong>Formato:</strong> ZPL (Zebra Programming Language)<br />
                  <strong>Código de Barras:</strong> Code128 com IMEI
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
