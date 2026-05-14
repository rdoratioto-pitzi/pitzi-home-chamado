import { useState } from "react";
import { CheckCircle2, Circle, Trash2, Plus } from "lucide-react";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

interface SubtaskListProps {
  subtasks: Subtask[];
  onCreate: (title: string) => Promise<void>;
  onToggle: (id: string, done: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export function SubtaskList({
  subtasks,
  onCreate,
  onToggle,
  onDelete,
  loading,
}: SubtaskListProps) {
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const total = subtasks.length;
  const done = subtasks.filter((s) => s.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function handleCreate() {
    const v = draft.trim();
    if (!v || creating) return;
    setCreating(true);
    try {
      await onCreate(v);
      setDraft("");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(s: Subtask) {
    if (busyId) return;
    setBusyId(s.id);
    try {
      await onToggle(s.id, !s.done);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await onDelete(id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {total > 0 && (
        <div className="flex items-center gap-2 text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          <div style={{ width: 80, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
            <div
              style={{
                width: `${pct}%`,
                height: "100%",
                borderRadius: 2,
                background: "#3B42DE",
                transition: "width 200ms ease",
              }}
            />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {done}/{total}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {subtasks.map((s) => (
          <div
            key={s.id}
            className="group flex items-center gap-2 px-2 py-1.5 rounded"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              opacity: busyId === s.id ? 0.5 : 1,
            }}
          >
            <button
              type="button"
              onClick={() => handleToggle(s)}
              disabled={!!busyId}
              className="flex-shrink-0"
              style={{ color: s.done ? "#5B62EC" : "rgba(255,255,255,0.4)" }}
              aria-label={s.done ? "Marcar como pendente" : "Concluir subtarefa"}
            >
              {s.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </button>
            <span
              className={`text-xs flex-1 ${s.done ? "line-through" : ""}`}
              style={{ color: s.done ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.75)" }}
            >
              {s.title}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(s.id)}
              disabled={!!busyId}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              style={{ color: "rgba(255,255,255,0.3)" }}
              aria-label="Excluir subtarefa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!loading && total === 0 && (
          <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.25)" }}>
            Nenhuma subtarefa
          </p>
        )}
      </div>

      <div className="flex gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nova subtarefa..."
          disabled={creating}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          className="flex-1 text-xs px-2 py-1 rounded outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)",
          }}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!draft.trim() || creating}
          className="px-2 rounded transition-colors flex items-center justify-center"
          style={{
            background: draft.trim() ? "rgba(0,200,83,0.15)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(0,200,83,0.2)",
            color: draft.trim() ? "#5B62EC" : "rgba(255,255,255,0.2)",
          }}
          aria-label="Adicionar subtarefa"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
