import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RenovLogo } from "@/components/renov-logo";
import { useTheme } from "@/hooks/use-theme";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function BrandSettings() {
  const { toast } = useToast();
  const [logoPreviewLight, setLogoPreviewLight] = useState<string | null>(null);
  const [logoPreviewDark, setLogoPreviewDark] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'light' | 'dark') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes("image/png") && !file.type.includes("image/svg") && !file.type.includes("image/jpeg")) {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie um arquivo PNG, JPG ou SVG.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (type === 'light') setLogoPreviewLight(reader.result as string);
        else setLogoPreviewDark(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (type: 'light' | 'dark') => {
    const value = type === 'light' ? logoPreviewLight : logoPreviewDark;
    if (!value) return;
    
    setIsSaving(true);
    const key = type === 'light' ? "logo_url_light" : "logo_url_dark";
    try {
      await apiRequest("POST", "/api/settings", { key, value });
      queryClient.invalidateQueries({ queryKey: [`/api/settings/${key}`] });
      toast({
        title: "Logo atualizado",
        description: `O logo do tema ${type === 'light' ? 'claro' : 'escuro'} foi atualizado.`,
      });
      if (type === 'light') setLogoPreviewLight(null);
      else setLogoPreviewDark(null);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o novo logo.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo Renov Home</CardTitle>
          <CardDescription>
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
                  <Button size="sm" variant="ghost" onClick={() => setLogoPreviewLight(null)}>Cancelar</Button>
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
                  <Button size="sm" variant="ghost" className="text-white hover:text-white/80" onClick={() => setLogoPreviewDark(null)}>Cancelar</Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cores da Marca</CardTitle>
          <CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Tipografia</CardTitle>
          <CardDescription>
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
