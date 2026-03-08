import { Link } from "wouter";
import {
  BarChart3, GitMerge, Clock, TrendingDown, Route, Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LINKS = [
  { label: "Posição Estoques", href: "/estoques/posicao",         icon: Package,     cor: "text-blue-600"   },
  { label: "Pipeline",         href: "/estoques/pipeline",        icon: GitMerge,    cor: "text-purple-600" },
  { label: "Lead Time",        href: "/estoques/lead-time",       icon: Clock,       cor: "text-amber-600"  },
  { label: "Aging FIFO",       href: "/estoques/aging",           icon: TrendingDown, cor: "text-red-600"   },
  { label: "Rastreabilidade",  href: "/estoques/rastreabilidade", icon: Route,       cor: "text-green-600"  },
  { label: "Contagem",         href: "/estoques/contagem",        icon: BarChart3,   cor: "text-cyan-600"   },
];

export function LinksRapidos() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">Acesso Rápido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {LINKS.map(({ label, href, icon: Icon, cor }) => (
            <Link key={href} href={href}>
              <Button variant="outline" size="sm" className="gap-1.5 h-8">
                <Icon className={`h-3.5 w-3.5 ${cor}`} />
                <span className="text-xs">{label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
