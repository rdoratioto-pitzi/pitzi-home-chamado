import { useState, useEffect } from "react";

interface Prompt {
  id: string;
  title: string;
  description?: string;
}

export default function PromptsDebugPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/prompts")
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then(data => {
        setPrompts(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Debug de Prompts</h1>

      {loading && <p>Carregando...</p>}

      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && (
        <div>
          <p>Total de prompts: {prompts.length}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {prompts.map((p, i) => (
              <div key={i} className="p-4 border rounded">
                <h3>{p.title}</h3>
                <p>{p.description?.substring(0, 50)}...</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
