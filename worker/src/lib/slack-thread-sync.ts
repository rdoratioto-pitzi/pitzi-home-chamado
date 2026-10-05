import { and, eq } from "drizzle-orm";
import { tickets, ticketComments, type Ticket, type TicketComment } from "../../../shared/schema";
import { plainTextToHtml, slackTextToPlain } from "../../../shared/slack-ticket";
import { canViewTicket } from "../../../server/services/ticket-queue.service";
import { getStorage } from "./storage";
import { resolveSlackPerson } from "./slack-people";
import { slackApi, isAllowedSlackTeam } from "./slack-api";
import type { AppEnv } from "../index";

/** A repeated Event API delivery cannot insert the same note twice. */
export async function recordSlackThreadMessage(db: any, env: AppEnv["Bindings"], teamId: string, event: any) {
  if (!event || event.type !== "message" || event.bot_id || event.bot_profile || event.subtype ||
      !event.user || !event.channel || !event.ts || !event.thread_ts || event.ts === event.thread_ts) return;
  const linked: Ticket[] = await db.select().from(tickets).where(and(
    eq(tickets.slackTeamId, teamId), eq(tickets.slackChannelId, event.channel), eq(tickets.slackThreadTs, event.thread_ts),
  ));
  if (!linked.length) return;
  const text = slackTextToPlain(event.text);
  if (!text) return;
  const person = await resolveSlackPerson(db, env, event.user);
  if (!person.ok) return;
  const storage = getStorage(db);
  for (const ticket of linked) {
    if (ticket.slackMessageTs === event.ts || !(await canViewTicket(storage, {
      userId: person.user.id, isAdmin: person.user.isAdmin === true, tenantId: person.user.tenantId ?? null,
    }, ticket))) continue;
    await db.insert(ticketComments).values({
      ticketId: ticket.id, tenantId: ticket.tenantId, userId: person.user.id,
      content: plainTextToHtml(text), source: "slack", isInternal: true,
      slackMessageKey: `${teamId}:${event.channel}:${event.ts}:${ticket.id}`,
    }).onConflictDoNothing();
    console.info("[slack-thread] note processed", { ticketId: ticket.id, messageTs: event.ts });
  }
}

/** Internal notes require separate explicit opt-in because Slack has its own audience. */
export async function sendCommentToSlackThread(env: AppEnv["Bindings"], ticket: Ticket, comment: TicketComment) {
  if (env.SLACK_THREAD_SYNC_ENABLED !== "true" || !env.SLACK_BOT_TOKEN || comment.source !== "app" ||
      !ticket.slackChannelId || !ticket.slackThreadTs || !ticket.slackTeamId) return;
  if (!(await isAllowedSlackTeam(env, ticket.slackTeamId))) return;
  if (comment.isInternal && env.SLACK_INTERNAL_NOTES_TO_THREAD_ENABLED !== "true") return;
  const text = comment.content.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
  const result = await slackApi(env.SLACK_BOT_TOKEN, "chat.postMessage", {
    channel: ticket.slackChannelId, thread_ts: ticket.slackThreadTs,
    text: `🎫 ${ticket.code}\n${text}`, parse: "none", unfurl_links: false, unfurl_media: false,
  });
  if (!result.ok) console.error("[slack-thread] outbound failed", { commentId: comment.id, error: result.error });
}
