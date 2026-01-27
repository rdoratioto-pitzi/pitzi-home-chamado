import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Truck, Package, Clock, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const freightFormSchema = z.object({
  cidadeOrigem: z.string().min(2, "Cidade de origem é obrigatória"),
  cidadeDestino: z.string().min(2, "Cidade de destino é obrigatória"),
  peso: z.string().min(1, "Peso é obrigatório"),
  volume: z.string().min(1, "Volume é obrigatório"),
});

type FreightFormData = z.infer<typeof freightFormSchema>;

type FreightQuote = {
  operador: string;
  servico: string;
  prazo: string;
  valor: number;
  logo?: string;
};

export default function SimularFretePage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [quotes, setQuotes] = useState<FreightQuote[]>([]);

  const form = useForm<FreightFormData>({
    resolver: zodResolver(freightFormSchema),
    defaultValues: {
      cidadeOrigem: "",
      cidadeDestino: "",
      peso: "",
      volume: "",
    },
  });

  const onSubmit = async (data: FreightFormData) => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const peso = parseFloat(data.peso);
      const basePrice = peso * 5;
      
      const mockQuotes: FreightQuote[] = [
        { operador: "Correios", servico: "PAC", prazo: "8 a 12 dias úteis", valor: basePrice * 0.8 },
        { operador: "Correios", servico: "SEDEX", prazo: "3 a 5 dias úteis", valor: basePrice * 1.5 },
        { operador: "Jadlog", servico: "Package", prazo: "5 a 8 dias úteis", valor: basePrice * 1.1 },
        { operador: "Azul Cargo", servico: "Amanhã", prazo: "1 dia útil", valor: basePrice * 3 },
      ];

      setQuotes(mockQuotes.sort((a, b) => a.valor - b.valor));
      toast({ title: "Cotações carregadas com sucesso!" });
    } catch (error) {
      toast({ title: "Erro ao simular frete", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader 
        title="Simulador de Frete" 
        description="Compare preços e prazos entre os operadores parceiros."
        breadcrumbs={[
          { label: "Logística", href: "/logistica" },
          { label: "Simular Frete" },
        ]}
      />

      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-6">
              <CardTitle className="text-[18px] font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Dados da Carga
              </CardTitle>
              <CardDescription className="text-[13px]">Preencha as informações para realizar a cotação</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="cidadeOrigem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-bold text-muted-foreground/80">Cidade Origem</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: São Paulo, SP" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cidadeDestino"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-bold text-muted-foreground/80">Cidade Destino</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Rio de Janeiro, RJ" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="peso"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-bold text-muted-foreground/80">Peso (kg)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="10" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="volume"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-bold text-muted-foreground/80">Volume (m³)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0,5" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 font-bold text-sm mt-2" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                    Simular Frete
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {quotes.length === 0 ? (
              <div className="h-full min-h-[400px] flex items-center justify-center text-center p-8 border-2 border-dashed border-border/60 rounded-xl bg-muted/5">
                <div>
                  <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Truck className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <h3 className="text-[16px] font-bold text-muted-foreground">Aguardando dados</h3>
                  <p className="text-[13px] text-muted-foreground/60 mt-2 max-w-[200px] mx-auto">Preencha o formulário para visualizar as melhores opções de frete</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[18px] font-bold tracking-tight">Cotações Disponíveis</h3>
                  <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-wider">{quotes.length} Opções</Badge>
                </div>
                {quotes.map((quote, index) => (
                  <Card 
                    key={index} 
                    className={`shadow-sm transition-all duration-200 hover:shadow-md ${index === 0 ? "border-primary/50 ring-1 ring-primary/20 bg-primary/5" : "border-border/60"}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${index === 0 ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
                            <Truck className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-[15px] font-bold leading-tight">{quote.operador}</p>
                            <p className="text-[12px] text-muted-foreground mt-1">{quote.servico}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[20px] font-bold text-primary leading-tight">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.valor)}
                          </p>
                          <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground mt-1 font-medium">
                            <Clock className="h-3 w-3" />
                            <span>{quote.prazo}</span>
                          </div>
                        </div>
                      </div>
                      {index === 0 && (
                        <Button className="w-full h-9 mt-4 font-bold text-xs">
                          Selecionar Melhor Opção
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
