import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react";
import { TypeBadge } from "./Badges";
import { ExportButton } from "./ExportButton";
import { GitRepository } from "../index";

interface GitCommit {
  id: string;
  sha: string;
  message: string;
  fullMessage: string | null;
  authorName: string;
  authorEmail: string | null;
  authorAvatarUrl: string | null;
  commitType: string;
  branch: string | null;
  prNumber: number | null;
  filesChanged: number;
  additions: number;
  deletions: number;
  committedAt: string;
}

interface CommitsTableProps {
  repositories: GitRepository[];
  selectedRepoId: string;
  selectedDevName: string;
}

export function CommitsTable({ repositories, selectedRepoId, selectedDevName }: CommitsTableProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [hoveredCommit, setHoveredCommit] = useState<GitCommit | null>(null);
  const limit = 15;

  const { data, isLoading } = useQuery<{ commits: GitCommit[]; total: number }>({
    queryKey: ["/api/git-analytics/commits", selectedRepoId, selectedDevName, typeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRepoId !== "all") params.set("repositoryId", selectedRepoId);
      if (selectedDevName !== "all") params.set("authorName", selectedDevName);
      if (typeFilter !== "all") params.set("commitType", typeFilter);
      params.set("limit", String(limit));
      params.set("offset", String((page - 1) * limit));
      const res = await fetch(`/api/git-analytics/commits?${params}`);
      return res.json();
    },
  });

  const commits = data?.commits || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Filtrar por busca local
  const filteredCommits = search
    ? commits.filter(c => 
        c.message.toLowerCase().includes(search.toLowerCase()) ||
        c.authorName.toLowerCase().includes(search.toLowerCase()) ||
        c.sha.toLowerCase().includes(search.toLowerCase())
      )
    : commits;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRepoName = (commit: GitCommit) => {
    // Por enquanto retorna o primeiro repo, depois podemos melhorar
    return repositories[0]?.name || "—";
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por mensagem, autor ou hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="feature">Features</SelectItem>
            <SelectItem value="bugfix">Correções</SelectItem>
            <SelectItem value="improvement">Melhorias</SelectItem>
            <SelectItem value="refactor">Refatoração</SelectItem>
            <SelectItem value="docs">Documentação</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {total} commits
        </div>
        <ExportButton
          data={filteredCommits}
          filename={`commits-${new Date().toISOString().split('T')[0]}`}
          columns={[
            { key: "sha", label: "Hash" },
            { key: "commitType", label: "Tipo" },
            { key: "message", label: "Mensagem" },
            { key: "authorName", label: "Autor" },
            { key: "additions", label: "Adições" },
            { key: "deletions", label: "Deleções" },
            { key: "committedAt", label: "Data" },
          ]}
        />
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Hash</TableHead>
              <TableHead className="w-[100px]">Tipo</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="w-[150px]">Autor</TableHead>
              <TableHead className="w-[100px] text-center">Linhas</TableHead>
              <TableHead className="w-[150px]">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredCommits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum commit encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredCommits.map((commit) => (
                <TableRow 
                  key={commit.id} 
                  className="relative group"
                  onMouseEnter={() => setHoveredCommit(commit)}
                  onMouseLeave={() => setHoveredCommit(null)}
                >
                  <TableCell className="font-mono text-xs">
                    <a
                      href={`https://github.com/${repositories[0]?.fullName}/commit/${commit.sha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-1"
                    >
                      {commit.sha.substring(0, 7)}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={commit.commitType} showIcon={false} />
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="truncate" title={commit.message}>
                      {commit.message}
                    </div>
                    {/* Tooltip com mensagem completa */}
                    {hoveredCommit?.id === commit.id && commit.fullMessage && commit.fullMessage !== commit.message && (
                      <div className="absolute z-50 left-[100px] top-full mt-1 w-[400px] p-3 bg-popover border rounded-lg shadow-xl text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-xs text-blue-500">{commit.sha.substring(0, 7)}</span>
                          <TypeBadge type={commit.commitType} showIcon={false} />
                        </div>
                        <pre className="whitespace-pre-wrap text-xs text-muted-foreground max-h-[200px] overflow-auto">
                          {commit.fullMessage}
                        </pre>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
                          <span>{commit.authorName}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-emerald-500">+{commit.additions}</span>
                            <span className="text-red-500">-{commit.deletions}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                        {commit.authorName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm truncate max-w-[100px]">{commit.authorName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-emerald-600 text-xs">+{commit.additions}</span>
                    {" / "}
                    <span className="text-red-500 text-xs">-{commit.deletions}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(commit.committedAt)}
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
