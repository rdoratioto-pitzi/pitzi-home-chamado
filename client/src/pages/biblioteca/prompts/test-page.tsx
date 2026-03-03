import { useState } from "react";

export default function TestPromptsPage() {
  const [prompts, setPrompts] = useState([]);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Teste de Prompts</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {prompts.map((prompt) => (
          <div key={prompt.id} className="p-4 border rounded-lg">
            <h3 className="font-semibold">{prompt.title}</h3>
            <p className="text-sm text-muted-foreground">{prompt.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
