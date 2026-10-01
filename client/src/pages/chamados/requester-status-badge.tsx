import { requesterStatus, type RequesterStatusTone } from "@shared/requester-view";

const TONE_CLASS: Record<RequesterStatusTone, string> = {
  neutral: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  progress: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  attention: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30",
  done: "bg-green-500/10 text-green-700 dark:text-green-300",
};

/** Status do chamado na linguagem do solicitante ("Recebido", "Aguardando você"...). */
export function RequesterStatusBadge({ status }: { status: string | null | undefined }) {
  const s = requesterStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[s.tone]}`}>
      {s.label}
    </span>
  );
}
