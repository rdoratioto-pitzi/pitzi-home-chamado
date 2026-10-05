// Chamadas à Slack Web API usadas pelo /chamado e pelo atalho "Transformar em chamado".
// fetch direto (form-urlencoded aceito por todos os métodos), sem o SDK: rápido o bastante
// para abrir a janela dentro dos 3 s que o Slack dá ao trigger_id.

export interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

export async function slackApi(
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<SlackApiResponse> {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    form.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  try {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: form.toString(),
    });
    const data = (await res.json()) as SlackApiResponse;
    if (!data.ok) console.warn(`[slack-chamados] ${method} falhou:`, data.error);
    return data;
  } catch (error) {
    console.warn(`[slack-chamados] ${method} erro de rede:`, error);
    return { ok: false, error: "network_error" };
  }
}

/** Mensagem só para uma pessoa; se não der no canal (bot fora dele), manda na DM do app. */
export async function notifyPerson(
  token: string,
  slackUserId: string,
  text: string,
  channelId?: string | null,
): Promise<void> {
  if (channelId) {
    const ephemeral = await slackApi(token, "chat.postEphemeral", { channel: channelId, user: slackUserId, text });
    if (ephemeral.ok) return;
  }
  await slackApi(token, "chat.postMessage", { channel: slackUserId, text });
}

let verifiedWorkspace: { token: string; teamId: string; expiresAt: number } | undefined;

/** Explicit allowlist, or the workspace authenticated by the installed bot token. */
export async function isAllowedSlackTeam(env: {
  SLACK_ALLOWED_TEAM_IDS?: string; SLACK_ALLOWED_TEAM_ID?: string; SLACK_BOT_TOKEN?: string;
}, teamId: string | null | undefined): Promise<boolean> {
  if (!teamId) return false;
  const configured = env.SLACK_ALLOWED_TEAM_IDS ?? env.SLACK_ALLOWED_TEAM_ID;
  if (configured) return configured.split(",").map((id) => id.trim()).filter(Boolean).includes(teamId);
  if (!env.SLACK_BOT_TOKEN) return false;
  if (!verifiedWorkspace || verifiedWorkspace.token !== env.SLACK_BOT_TOKEN || verifiedWorkspace.expiresAt < Date.now()) {
    const auth = await slackApi(env.SLACK_BOT_TOKEN, "auth.test", {});
    if (!auth.ok || !auth.team_id) return false;
    verifiedWorkspace = { token: env.SLACK_BOT_TOKEN, teamId: auth.team_id, expiresAt: Date.now() + 300_000 };
  }
  return verifiedWorkspace.teamId === teamId;
}
