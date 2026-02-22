import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertTriangle, CheckCircle2, ExternalLink, X } from "lucide-react";
import { SeverityBadge } from "./Badges";

interface SecurityAlert {
  id: string;
  repositoryId: string;
  githubAlertNumber: number;
  title: string;
  description: string;
  severity: string;
  packageName: string;
  packageEcosystem: string;
  vulnerableVersion: string;
  patchedVersion: string | null;
  status: string;
  isDirectDependency: boolean;
  cveId: string | null;
  ghsaId: string | null;
  createdAt: string;
  repositoryName?: string;
}

interface SecurityModalProps {
  open: boolean;
  onClose: () => void;
  repositoryName?: string;
  repositoryFullName?: string;
  repositories?: { id: string; name: string; fullName: string }[];
}

export function SecurityModal({ open, onClose, repositoryName, repositoryFullName, repositories }: SecurityModalProps) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");

  const { data: alerts = [] } = useQuery<SecurityAlert[]>({
    queryKey: ["/api/git-analytics/security-alerts", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/git-analytics/security-alerts?${params}`);
      return res.json();
    },
    enabled: open,
  });

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    return true;
  });

  // Mapear nome do repositório para cada alerta
  const alertsWithRepoName = filteredAlerts.map(alert => ({
    ...alert,
    repositoryName: repositories?.find(r => r.id === alert.repositoryId)?.name || "Desconhecido",
  }));

  const openCount = alerts.filter((a) => a.status === "open").length;
  const fixedCount = alerts.filter((a) => a.status === "fixed").length;

  const getDaysAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-amber-500" />
            <div>
              <DialogTitle className="text-xl">Dependabot Alerts</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {repositoryFullName || "Todos os repositórios"} • Verificado recentemente
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs e Filtros */}
        <div className="flex items-center justify-between py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setStatusFilter("open")}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                statusFilter === "open"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              {openCount} Open
            </button>
            <button
              onClick={() => setStatusFilter("fixed")}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                statusFilter === "fixed"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {fixedCount} Fixed
            </button>
          </div>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Severidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Alerts */}
        <div className="flex-1 overflow-y-auto">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum alerta encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {alertsWithRepoName.map((alert) => (
                <div
                  key={alert.id}
                  className="px-4 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                        alert.severity === "critical" || alert.severity === "high"
                          ? "text-orange-500"
                          : "text-blue-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-sm">{alert.title}</h3>
                        <SeverityBadge severity={alert.severity} />
                        {alert.isDirectDependency && (
                          <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                            Direct
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-blue-500">{alert.repositoryName}</span>
                        {" • "}#{alert.githubAlertNumber} opened {getDaysAgo(alert.createdAt)} days ago •{" "}
                        <span className="font-medium">{alert.packageName}</span> ({alert.packageEcosystem})
                        {alert.vulnerableVersion && ` • ${alert.vulnerableVersion}`}
                      </p>
                      {alert.patchedVersion && (
                        <p className="text-xs text-emerald-600 mt-1">
                          ✓ Patch available: {alert.patchedVersion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="mr-2">
            Fechar
          </Button>
          {repositoryFullName && (
            <Button
              onClick={() => window.open(`https://github.com/${repositoryFullName}/security/dependabot`, "_blank")}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir no GitHub
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
