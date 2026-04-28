import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BarChart3, 
  TrendingDown, 
  TrendingUp, 
  Target, 
  Activity 
} from "lucide-react";

interface KPIsData {
  totalDigitado: number;
  totalAvaliado: number;
  totalComprado: number;
  avgRR: number;
  avgCR: number;
  modelosCount: number;
}

interface PricingKPIsProps {
  kpis: KPIsData | null;
}

export function PricingKPIs({ kpis }: PricingKPIsProps) {
  if (!kpis) return null;

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString("pt-BR");
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {/* Total Digitado */}
      <Card className="border border-border/70 shadow-sm bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Digitado</p>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(kpis.totalDigitado)}
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-primary/70" />
          </div>
        </CardContent>
      </Card>

      {/* Total Avaliado */}
      <Card className="border border-border/70 shadow-sm bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Avaliado</p>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(kpis.totalAvaliado)}
              </p>
            </div>
            <Activity className="w-5 h-5 text-primary/70" />
          </div>
        </CardContent>
      </Card>

      {/* Total Comprado */}
      <Card className="border border-border/70 shadow-sm bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Comprado</p>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(kpis.totalComprado)}
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-primary/70" />
          </div>
        </CardContent>
      </Card>

      {/* Taxa de Rejeição (RR) */}
      <Card className="border border-border/70 shadow-sm bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Taxa RR</p>
              <p className="text-2xl font-bold text-foreground">
                {formatPercent(kpis.avgRR)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Rejeição média</p>
            </div>
            <TrendingDown className="w-5 h-5 text-primary/70" />
          </div>
        </CardContent>
      </Card>

      {/* Taxa de Conversão (CR) */}
      <Card className="border border-border/70 shadow-sm bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Taxa CR</p>
              <p className="text-2xl font-bold text-foreground">
                {formatPercent(kpis.avgCR)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Conversão média</p>
            </div>
            <Target className="w-5 h-5 text-primary/70" />
          </div>
        </CardContent>
      </Card>

      {/* Modelos */}
      <Card className="border border-border/70 shadow-sm bg-card">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Modelos</p>
              <p className="text-2xl font-bold text-foreground">
                {kpis.modelosCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">No ranking</p>
            </div>
            <BarChart3 className="w-5 h-5 text-primary/70" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
