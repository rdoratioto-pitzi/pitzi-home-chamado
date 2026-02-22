import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ExternalLink, Search, GitMerge, GitPullRequest, XCircle } from "lucide-react";
import { TypeBadge, StatusBadge } from "./Badges";
import { ExportButton } from "./ExportButton";
import { GitRepository } from "../index";

interface GitPullRequest {
  id: string;
  repositoryId: string;
  githubPrNumber: number;
  title: string;
  description: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  status: string;
  prType: string;
  sourceBranch: string | null;
  targetBranch: string | null;
  commitsCount: number;
  additions: number;
  deletions: number;
  reviewers: string | null;
  labels: string | null;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
}

interface PullRequestsTableProps {
  repositories: GitRepository[];
  selectedRepoId: string;
  selectedDevName: string;
}

export function PullRequestsTable({ repositories, selectedRepoId, selectedDevName }: PullRequestsTableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const limit = 15;

  const { data, isLoading } = useQuery<{ pullRequests: GitPullRequest[]; total: number }>({
    queryKey: ["/api/git-analytics/pull-requests", selectedRepoId, selectedDevName, statusFilter, typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRepoId !== "all") params.set("repositoryId", selectedRepoId);
      if (selectedDevName !== "all") params.set("authorName", selectedDevName);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("prType", typeFilter);
      params.set("limit", String(limit));
      params.set("offset", String((page - 1) * limit));
      const res = await fetch(`/api/git-analytics/pull-requests?${params}`);
      return res.json();
    },
  });

  const pullRequests = data?.pullRequests || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Filtrar por busca local
  const filteredPRs = search
    ? pullRequests.filter(pr => 
        pr.title.toLowerCase().includes(search.toLowerCase()) ||
        pr.authorName.toLowerCase().includes(search.toLowerCase()) ||
        String(pr.githubPrNumber).includes(search)
      )
    : pullRequests;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "merged":
        return <GitMerge className="h-4 w-4 text-purple-500" />;
      case "closed":
        return <XCircle className="h-4 w-4 text-slate-500" />;
      default:
        return <GitPullRequest className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, autor ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="merged">Merged</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="feature">Features</SelectItem>
            <SelectItem value="bugfix">Correções</SelectItem>
            <SelectItem value="improvement">Melhorias</SelectItem>
            <SelectItem value="refactor">Refatoração</SelectItem>
            <SelectItem value="docs">Documentação</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {total} pull requests
        </div>
        <ExportButton
          data={filteredPRs}
          filename={`pull-requests-${new Date().toISOString().split('T')[0]}`}
          columns={[
            { key: "githubPrNumber", label: "Número" },
            { key: "status", label: "Status" },
            { key: "prType", label: "Tipo" },
            { key: "title", label: "Título" },
            { key: "authorName", label: "Autor" },
            { key: "sourceBranch", label: "Branch Origem" },
            { key: "targetBranch", label: "Branch Destino" },
            { key: "commitsCount", label: "Commits" },
            { key: "additions", label: "Adições" },
            { key: "deletions", label: "Deleções" },
            { key: "createdAt", label: "Criado em" },
            { key: "mergedAt", label: "Merged em" },
          ]}
        />
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[80px]">#</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px]">Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-[130px]">Autor</TableHead>
              <TableHead className="w-[120px]">Branch</TableHead>
              <TableHead className="w-[80px] text-center">Commits</TableHead>
              <TableHead className="w-[100px]">Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredPRs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum pull request encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredPRs.map((pr) => (
                <TableRow key={pr.id} className="group">
                  <TableCell>
                    <a
                      href={`https://github.com/${repositories[0]?.fullName}/pull/${pr.githubPrNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-1 font-medium"
                    >
                      #{pr.githubPrNumber}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {getStatusIcon(pr.status)}
                      <StatusBadge status={pr.status} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={pr.prType} showIcon={false} />
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <div className="truncate font-medium" title={pr.title}>
                      {pr.title}
                    </div>
                    {pr.description && (
                      <div className="truncate text-xs text-muted-foreground" title={pr.description}>
                        {pr.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                        {pr.authorName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm truncate max-w-[80px]">{pr.authorName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <span className="text-muted-foreground">{pr.sourceBranch || "—"}</span>
                      <span className="mx-1">→</span>
                      <span className="font-medium">{pr.targetBranch || "main"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {pr.commitsCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(pr.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
