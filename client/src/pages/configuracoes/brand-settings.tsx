import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RenovLogo } from "@/components/renov-logo";
import { useTheme } from "@/hooks/use-theme";

export function BrandSettings() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes("image/png") && !file.type.includes("image/svg")) {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie um arquivo PNG ou SVG.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    toast({
      title: "Logo atualizado",
      description: "O logo foi atualizado com sucesso.",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logo Renov Home</CardTitle>
          <CardDescription>
            Faça upload de um novo logo para exibir na sidebar e no cabeçalho
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Logo Atual</Label>
            <div className="flex gap-6">
              <div className="p-6 rounded-lg bg-background border">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" className="h-12 w-auto" />
                ) : (
                  <RenovLogo variant="light" className="h-12 w-auto" />
                )}
                <p className="text-xs text-muted-foreground mt-2 text-center">Tema Claro</p>
              </div>
              <div className="p-6 rounded-lg bg-slate-900">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Preview" className="h-12 w-auto" />
                ) : (
                  <RenovLogo variant="dark" className="h-12 w-auto" />
                )}
                <p className="text-xs text-slate-400 mt-2 text-center">Tema Escuro</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fazer Upload</Label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Input 
                type="file" 
                accept=".png,.svg"
                className="hidden"
                id="logo-upload"
                onChange={handleFileChange}
                data-testid="input-logo-upload"
              />
              <label 
                htmlFor="logo-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="p-3 rounded-full bg-muted">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Clique para fazer upload</p>
                  <p className="text-sm text-muted-foreground">
                    PNG ou SVG, máximo 2MB
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} data-testid="button-save-logo">
              Salvar Logo
            </Button>
            {logoPreview && (
              <Button variant="outline" onClick={() => setLogoPreview(null)}>
                Restaurar Original
              </Button>
            )}
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
