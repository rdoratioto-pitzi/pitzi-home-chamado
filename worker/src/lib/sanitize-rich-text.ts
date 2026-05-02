import sanitizeHtml from "sanitize-html";

export interface MentionRef {
  userId: string;
  displayName: string;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br",
    "strong", "em", "u", "s",
    "h1", "h2", "h3",
    "ul", "ol", "li",
    "blockquote", "pre", "code",
    "a", "span",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["class", "data-user-id", "data-display-name"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  // Mantém span.mention vazio se vier sem texto
  allowedSchemesAppliedToAttributes: ["href"],
  disallowedTagsMode: "discard",
  parser: { lowerCaseTags: true, lowerCaseAttributeNames: true },
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, SANITIZE_OPTIONS);
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
