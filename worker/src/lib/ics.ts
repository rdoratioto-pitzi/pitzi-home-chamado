/**
 * ICS Calendar generation utilities.
 * Faithful reproduction from server/email-service.ts (lines 707-813).
 * Depends on: date-fns-tz (already a project dependency, pure JS).
 */
import { fromZonedTime } from "date-fns-tz";

export function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export function escapeICSParam(text: string): string {
  if (text.includes(",") || text.includes(";") || text.includes(":") || text.includes('"')) {
    return `"${text.replace(/"/g, '\\"')}"`;
  }
  return text;
}

export function foldICSLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let current = line;
  while (current.length > 75) {
    parts.push(current.substring(0, 75));
    current = " " + current.substring(75);
  }
  parts.push(current);
  return parts.join("\r\n");
}

interface MeetingICSInput {
  title: string;
  date: string;        // "YYYY-MM-DD"
  time: string;        // "HH:mm"
  location?: string;
  description?: string;
  organizerName: string;
  organizerEmail: string;
  isRecurring?: boolean;
  recurrenceType?: string;
  recurrenceWeekdays?: number[];
  recurrenceEndDate?: string;
}

export function generateICSContent(
  meeting: MeetingICSInput,
  attendees: { name: string; email: string }[]
): string {
  const uid = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@renovhome.com.br`;
  const now = new Date();
  const SAO_PAULO_TZ = "America/Sao_Paulo";

  const [year, month, day] = meeting.date.split("-").map(Number);
  const [hour, minute] = meeting.time.split(":").map(Number);
  const localDateTime = new Date(year, month - 1, day, hour, minute, 0);
  const startUTC = fromZonedTime(localDateTime, SAO_PAULO_TZ);
  const endUTC = new Date(startUTC.getTime() + 60 * 60 * 1000);

  const formatDateUTC = (d: Date): string =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const dtStart = formatDateUTC(startUTC);
  const dtEnd = formatDateUTC(endUTC);

  const attendeeLines = attendees.map(
    (a) => `ATTENDEE;CN=${escapeICSParam(a.name)};RSVP=TRUE:mailto:${a.email}`
  );

  let rrule = "";
  if (meeting.isRecurring) {
    if (meeting.recurrenceType === "daily") {
      rrule = "RRULE:FREQ=DAILY";
    } else if (meeting.recurrenceType === "weekly" && meeting.recurrenceWeekdays?.length) {
      const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      const dayList = meeting.recurrenceWeekdays.map((d) => days[d]).join(",");
      rrule = `RRULE:FREQ=WEEKLY;BYDAY=${dayList}`;
    }
    if (rrule && meeting.recurrenceEndDate) {
      const [ey, em, ed] = meeting.recurrenceEndDate.split("-").map(Number);
      const endLocalDateTime = new Date(ey, em - 1, ed, 23, 59, 59);
      const untilUTC = fromZonedTime(endLocalDateTime, SAO_PAULO_TZ);
      rrule += `;UNTIL=${formatDateUTC(untilUTC)}`;
    }
  }

  const rawLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Renov Home//Meeting Invite//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatDateUTC(now)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(meeting.title)}`,
    `LOCATION:${escapeICSText(meeting.location || "")}`,
    `DESCRIPTION:${escapeICSText(meeting.description || "")}`,
    `ORGANIZER;CN=${escapeICSParam(meeting.organizerName)}:mailto:${meeting.organizerEmail}`,
    ...attendeeLines,
    rrule,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((line) => line.length > 0);

  return rawLines.map((line) => foldICSLine(line)).join("\r\n");
}
