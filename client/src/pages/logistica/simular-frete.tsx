import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Truck, Package, Clock, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Mock quotes based on weight
      const peso = parseFloat(data.peso);
      const basePrice = peso * 5;
      
      const mockQuotes: FreightQuote[] = [
        {
          operador: "Correios",
          servico: "PAC",
          prazo: "8 a 12 dias úteis",
          valor: basePrice * 0.8,
        },
        {
          operador: "Correios",
          servico: "SEDEX",
          prazo: "3 a 5 dias úteis",
          valor: basePrice * 1.5,
        },
        {
          operador: "Jadlog",
          servico: "Package",
          prazo: "5 a 8 dias úteis",
          valor: basePrice * 1.1,
        },
        {
          operador: "Azul Cargo",
          servico: "Amanhã",
          prazo: "1 dia útil",
          valor: basePrice * 3,
        },
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
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Dados da Carga
              </CardTitle>
              <CardDescription>Preencha para cotar</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cidadeOrigem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade Origem</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="São Paulo"
                            {...field}
                            data-testid="input-cidade-origem"
                          />
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
                        <FormLabel>Cidade Destino</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Rio de Janeiro"
                            {...field}
                            data-testid="input-cidade-destino"
                          />
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
                          <FormLabel>Peso (kg)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.1"
                              placeholder="10"
                              {...field}
                              data-testid="input-peso"
                            />
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
                          <FormLabel>Volume (m³)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              step="0.01"
                              placeholder="0,5"
                              {...field}
                              data-testid="input-volume"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-cotar"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Truck className="h-4 w-4 mr-2" />
                    )}
                    Cotar Agora
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            {quotes.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                <div>
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Preencha os dados ao lado para ver as cotações</p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-medium text-lg">Cotações Disponíveis</h3>
                {quotes.map((quote, index) => (
                  <Card 
                    key={index} 
                    className={index === 0 ? "ring-2 ring-primary" : ""}
                    data-testid={`quote-${index}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                            <Truck className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold" data-testid={`quote-operador-${index}`}>{quote.operador}</p>
                            <p className="text-sm text-muted-foreground" data-testid={`quote-servico-${index}`}>{quote.servico}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary" data-testid={`quote-valor-${index}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.valor)}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span data-testid={`quote-prazo-${index}`}>{quote.prazo}</span>
                          </div>
                        </div>
                      </div>
                      {index === 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <Button className="w-full" data-testid="button-select-quote">
                            Selecionar Esta Opção
                          </Button>
                        </div>
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
