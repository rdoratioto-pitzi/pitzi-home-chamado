import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/queryClient";

interface BackendVersion {
  version: string;
  commit: string;
  buildDate: string;
  environment: string;
}

export function VersionBadge() {
  const [expanded, setExpanded] = useState(false);

  const frontVersion = import.meta.env.VITE_APP_VERSION || "dev";

  const { data: backVersion, isError } = useQuery<BackendVersion>({
    queryKey: ["/api/version"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/version");
      if (!res.ok) throw new Error("Failed to fetch version");
      return res.json();
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });

  return (
    <div
      className="px-3 py-2 cursor-pointer select-none"
      onClick={() => setExpanded(!expanded)}
      title="Clique para ver detalhes da versão"
    >
      {expanded ? (
        <div className="space-y-1 text-[10px] font-mono text-muted-foreground/60">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Front: {frontVersion}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                isError ? "bg-red-500" : "bg-green-500"
              }`}
            />
            <span>
              Back: {isError ? "offline" : (backVersion?.version ?? "...")}
            </span>
          </div>
        </div>
      ) : (
        <span className="text-[10px] font-mono text-muted-foreground/40">
          v{frontVersion}
        </span>
      )}
    </div>
  );
}
