// "Talvez isto ajude": até 3 artigos publicados parecidos com o título do chamado em abertura.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { fetchWithAuth } from "@/lib/queryClient";
import type { KnowledgeArticleWithAuthor } from "@shared/schema";

const STOPWORDS = new Set(["para", "com", "sem", "não", "nao", "que", "uma", "uns", "das", "dos", "pelo", "pela", "meu", "minha"]);

/** Palavra mais longa e significativa do título: a busca é por trecho (ILIKE). */
function keyword(title: string): string {
  const words = title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return words.sort((a, b) => b.length - a.length)[0] ?? "";
}

export function RelatedArticles({ title }: { title: string }) {
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(keyword(title)), 400);
    return () => clearTimeout(t);
  }, [title]);

  const { data } = useQuery<{ items: KnowledgeArticleWithAuthor[] }>({
    queryKey: ["/api/conhecimento/artigos", "sugestao", term],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/conhecimento/artigos?sugestao=1&limite=3&q=${encodeURIComponent(term)}`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: term.length >= 4,
    staleTime: 60_000,
  });
  const items = term.length >= 4 ? data?.items ?? [] : [];
  if (items.length === 0) return null;

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3" data-testid="kb-related">
      <p className="text-sm font-medium flex items-center gap-2 mb-2">
        <BookOpen className="h-4 w-4 text-primary" />
        Talvez isto ajude
      </p>
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/conhecimento/${a.id}`} className="text-sm text-primary hover:underline" target="_blank">
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
