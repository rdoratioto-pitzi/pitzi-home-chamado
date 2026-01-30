import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RenovLogo } from "@/components/renov-logo";
import { apiRequest, queryClient } from "@/lib/queryClient";

function normalizeObjectPath(path: string): string {
  if (!path) return "";
  if (path.startsWith("/objects/")) return path;
  return `/objects/${path.replace(/^\/objects\/?/, "").replace(/^\//, "")}`;
}

export function BrandSettings() {
  const { toast } = useToast();
  const [logoPreviewLight, setLogoPreviewLight] = useState<string | null>(null);
  const [logoPreviewDark, setLogoPreviewDark] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'light' | 'dark' | 'favicon' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: faviconSetting, refetch: refetchFavicon } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/favicon_url"],
    queryFn: async () => {
      const res = await fetch("/api/settings/favicon_url");
      if (!res.ok) return { value: "" };
      return res.json();
    },
    initialData: { value: "" }
  });

  const { data: logoUrlLightSetting, refetch: refetchLogoLight } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/logo_url_light"],
    queryFn: async () => {
      const res = await fetch("/api/settings/logo_url_light");
      if (!res.ok) return { value: "" };
      return res.json();
    },
    initialData: { value: "" }
  });

  const { data: logoUrlDarkSetting, refetch: refetchLogoDark } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/logo_url_dark"],
    queryFn: async () => {
      const res = await fetch("/api/settings/logo_url_dark");
      if (!res.ok) return { value: "" };
      return res.json();
    },
    initialData: { value: "" }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'light' | 'dark' | 'favicon') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes("image/png") && !file.type.includes("image/svg") && !file.type.includes("image/jpeg") && !file.type.includes("image/x-icon") && !file.type.includes("image/vnd.microsoft.icon")) {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie um arquivo PNG, JPG, SVG ou ICO.",
          variant: "destructive",
        });
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      if (type === 'light') setLogoPreviewLight(previewUrl);
      else if (type === 'dark') setLogoPreviewDark(previewUrl);
      else setFaviconPreview(previewUrl);
      
      setPendingFile({ file, type });
    }
  };

  const handleSave = async (type: 'light' | 'dark' | 'favicon') => {
    if (!pendingFile || pendingFile.type !== type) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo primeiro.",
        variant: "destructive"
      });
      return;
    }

    const { file } = pendingFile;
    const key = type === 'light' ? "logo_url_light" : type === 'dark' ? "logo_url_dark" : "favicon_url";
    
    setIsSaving(true);
    try {
      const requestRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type
        })
      });
      
      if (!requestRes.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const { uploadURL, objectPath } = await requestRes.json();
      
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type
        }
      });
      
      if (!uploadRes.ok) {
        throw new Error("Failed to upload file");
      }
      
      const fileUrl = normalizeObjectPath(objectPath);
      
      console.log("Saving file URL to settings:", key, fileUrl);
      await apiRequest("POST", "/api/settings", { key, value: fileUrl });
      await queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/settings", key] });
      
      if (type === 'favicon') {
        await refetchFavicon();
        updateBrowserFavicon(fileUrl);
      } else if (type === 'light') {
        await refetchLogoLight();
      } else if (type === 'dark') {
        await refetchLogoDark();
      }

      queryClient.setQueryData(["/api/settings", key], { value: fileUrl });

      toast({
        title: "Atualizado com sucesso",
        description: `${type === 'favicon' ? 'Favicon' : 'Logo'} atualizado.`,
      });

      if (type === 'light') setLogoPreviewLight(null);
      else if (type === 'dark') setLogoPreviewDark(null);
      else setFaviconPreview(null);
      
      setPendingFile(null);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível fazer o upload do arquivo.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateBrowserFavicon = (url: string) => {
    const normalizedUrl = normalizeObjectPath(url);
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach(link => link.remove());
    
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = normalizedUrl + '?t=' + Date.now();
    document.getElementsByTagName('head')[0].appendChild(link);
    
    const shortcutLink = document.createElement('link');
    shortcutLink.rel = 'shortcut icon';
    shortcutLink.href = normalizedUrl + '?t=' + Date.now();
    document.getElementsByTagName('head')[0].appendChild(shortcutLink);
  };

  const handleCancel = (type: 'light' | 'dark' | 'favicon') => {
    if (type === 'light') setLogoPreviewLight(null);
    else if (type === 'dark') setLogoPreviewDark(null);
    else setFaviconPreview(null);
    
    if (pendingFile?.type === type) {
      setPendingFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-[18px] font-bold">Logo Renov Home</CardTitle>
          <CardDescription className="text-[13px]">
            Clique nos quadros abaixo para fazer upload dos logos específicos para cada tema.
            Recomendado: 180x50px, até 5MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Light Theme Logo */}
            <div className="space-y-4">
              <Label>Tema Claro</Label>
              <div 
                className="relative group cursor-pointer p-8 rounded-lg bg-white border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[160px]"
                onClick={() => document.getElementById('logo-upload-light')?.click()}
              >
                <input 
                  type="file" 
                  id="logo-upload-light"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'light')}
                  accept=".png,.svg,.jpg,.jpeg"
                />
                {logoPreviewLight ? (
                  <img src={logoPreviewLight} alt="Preview Claro" className="h-12 w-auto object-contain" />
                ) : logoUrlLightSetting.value ? (
                  <img src={normalizeObjectPath(logoUrlLightSetting.value)} alt="Logo Claro Atual" className="h-12 w-auto object-contain" />
                ) : (
                  <RenovLogo variant="light" size="lg" className="h-12 w-auto" />
                )}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
              </div>
              {logoPreviewLight && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSave('light')} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Claro"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleCancel('light')}>Cancelar</Button>
                </div>
              )}
            </div>

            {/* Dark Theme Logo */}
            <div className="space-y-4">
              <Label>Tema Escuro</Label>
              <div 
                className="relative group cursor-pointer p-8 rounded-lg bg-slate-900 border-2 border-dashed border-white/10 hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[160px]"
                onClick={() => document.getElementById('logo-upload-dark')?.click()}
              >
                <input 
                  type="file" 
                  id="logo-upload-dark"
                  className="hidden"
                  onChange={(e) => handleFileChange(e, 'dark')}
                  accept=".png,.svg,.jpg,.jpeg"
                />
                {logoPreviewDark ? (
                  <img src={logoPreviewDark} alt="Preview Escuro" className="h-12 w-auto object-contain" />
                ) : logoUrlDarkSetting.value ? (
                  <img src={normalizeObjectPath(logoUrlDarkSetting.value)} alt="Logo Escuro Atual" className="h-12 w-auto object-contain" />
                ) : (
                  <RenovLogo variant="dark" size="lg" className="h-12 w-auto" />
                )}
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                  <Upload className="h-6 w-6 text-white" />
                </div>
              </div>
              {logoPreviewDark && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSave('dark')} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Escuro"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-white hover:text-white/80" onClick={() => handleCancel('dark')}>Cancelar</Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-[18px] font-bold">Favicon Renov Home</CardTitle>
          <CardDescription className="text-[13px]">
            Clique no quadro abaixo para fazer upload do ícone da aba do navegador.
            Medida ideal: 32x32px ou 48x48px. Formatos: PNG ou ICO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-sm">
            <Label>Ícone do Navegador (Favicon)</Label>
            <div 
              className="relative group cursor-pointer p-8 rounded-lg bg-white border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[120px] w-[120px]"
              onClick={() => document.getElementById('favicon-upload')?.click()}
            >
              <input 
                type="file" 
                id="favicon-upload"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'favicon')}
                accept=".png,.ico"
              />
              {faviconPreview ? (
                <img src={faviconPreview} alt="Preview Favicon" className="h-8 w-8 object-contain" />
              ) : faviconSetting.value ? (
                <img src={normalizeObjectPath(faviconSetting.value)} alt="Favicon Atual" className="h-8 w-8 object-contain" />
              ) : (
                <Image className="h-8 w-8 text-muted-foreground/40" />
              )}
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                <Upload className="h-5 w-5 text-primary" />
              </div>
            </div>
            {faviconPreview && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSave('favicon')} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Favicon"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleCancel('favicon')}>Cancelar</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-[18px] font-bold">Cores da Marca</CardTitle>
          <CardDescription className="text-[13px]">
            As cores oficiais da Renov são aplicadas automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-[#00A137] flex items-end p-2">
                <span className="text-white text-xs font-mono">#00A137</span>
              </div>
              <p className="text-sm font-medium">Verde Renov</p>
              <p className="text-xs text-muted-foreground">Cor primária</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-black flex items-end p-2">
                <span className="text-white text-xs font-mono">#000000</span>
              </div>
              <p className="text-sm font-medium">Preto</p>
              <p className="text-xs text-muted-foreground">Textos e contraste</p>
            </div>
            <div className="space-y-2">
              <div className="h-20 rounded-lg bg-white border flex items-end p-2">
                <span className="text-black text-xs font-mono">#FFFFFF</span>
              </div>
              <p className="text-sm font-medium">Branco</p>
              <p className="text-xs text-muted-foreground">Fundos e espaços</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-[18px] font-bold">Tipografia</CardTitle>
          <CardDescription className="text-[13px]">
            A família tipográfica Montserrat é utilizada em toda a interface
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <p className="text-3xl font-bold">Montserrat Bold</p>
              <p className="text-sm text-muted-foreground mt-1">Usado em títulos e destaques</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-xl font-medium">Montserrat Medium</p>
              <p className="text-sm text-muted-foreground mt-1">Usado em subtítulos</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-base font-normal">Montserrat Regular</p>
              <p className="text-sm text-muted-foreground mt-1">Usado em textos corridos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
