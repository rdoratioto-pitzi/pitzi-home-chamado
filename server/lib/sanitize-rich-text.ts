import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br",
  "strong", "em", "u", "s",
  "h1", "h2", "h3",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "span",
];

const ALLOWED_ATTR = ["href", "target", "rel", "class", "data-user-id", "data-display-name"];

const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|[^a-z]|[a-z+\-.]+(?![a-z+\-.:]))/i;

export interface MentionRef {
  userId: string;
  displayName: string;
}

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
  });
}

export function extractMentions(html: string | null | undefined): MentionRef[] {
  if (!html) return [];
  const seen = new Set<string>();
  const mentions: MentionRef[] = [];
  const re = /<span\b[^>]*\bclass="[^"]*\bmention\b[^"]*"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const userIdMatch = tag.match(/data-user-id="([^"]+)"/i);
    const displayNameMatch = tag.match(/data-display-name="([^"]+)"/i);
    const userId = userIdMatch?.[1];
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    mentions.push({
      userId,
      displayName: displayNameMatch?.[1] ?? "",
    });
  }
  return mentions;
}
