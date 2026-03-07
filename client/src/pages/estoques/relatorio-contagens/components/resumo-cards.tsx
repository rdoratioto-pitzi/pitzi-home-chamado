import React from "react";
import { Database, ClipboardCheck, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface ResumoData {
  totalSistema: number;
  totalContado: number;
  sobras: number;
  faltas: number;
  acuracidade: number;
}

interface ResumoCardsProps {
  resumo?: ResumoData;
  isLoading: boolean;
}

export function ResumoCards({ resumo, isLoading }: ResumoCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-6 w-6 rounded-full mb-3" />
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const acuracidade = resumo?.acuracidade ?? 0;
  const acuracidadeColor =
    acuracidade >= 98 ? "text-green-600" : acuracidade >= 95 ? "text-yellow-600" : "text-red-600";
  const acuracidadeBg =
    acuracidade >= 98 ? "bg-green-50" : acuracidade >= 95 ? "bg-yellow-50" : "bg-red-50";

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mb-3">
            <Database className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-sm text-muted-foreground">Itens Sistema</p>
          <p className="text-2xl font-bold text-blue-600">
            {(resumo?.totalSistema ?? 0).toLocaleString("pt-BR")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-50 mb-3">
            <ClipboardCheck className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-sm text-muted-foreground">Itens Contados</p>
          <p className="text-2xl font-bold text-green-600">
            {(resumo?.totalContado ?? 0).toLocaleString("pt-BR")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-yellow-50 mb-3">
            <TrendingUp className="h-5 w-5 text-yellow-600" />
          </div>
          <p className="text-sm text-muted-foreground">Sobras</p>
          <p className="text-2xl font-bold text-yellow-600">
            {(resumo?.sobras ?? 0).toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Físico não consta no sistema</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-50 mb-3">
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <p className="text-sm text-muted-foreground">Faltas</p>
          <p className="text-2xl font-bold text-red-600">
            {(resumo?.faltas ?? 0).toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Sistema não encontrado fisicamente</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${acuracidadeBg} mb-3`}>
            <Target className={`h-5 w-5 ${acuracidadeColor}`} />
          </div>
          <p className="text-sm text-muted-foreground">Acuracidade</p>
          <p className={`text-2xl font-bold ${acuracidadeColor}`}>{acuracidade.toFixed(1)}%</p>
        </CardContent>
      </Card>
    </div>
  );
}
