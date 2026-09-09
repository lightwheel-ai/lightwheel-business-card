export type ParsedCardData = Partial<{
  name: string;
  title: string;
  phone: string;
  email: string;
}>;

const namePattern = /^(?:姓名|名字|name)\s*[:：]\s*(.+)$/i;
const titlePattern = /^(?:职位|职务|title|position|role)\s*[:：]\s*(.+)$/i;
const contactPrefixPattern =
  /^(?:电话|手机|phone|tel|mobile|邮箱|邮件|email|mail)\s*[:：]\s*/i;
const emailPattern = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;
const phonePattern = /(?:\+?\d[\d ()–—-]{6,}\d)/;

export function parseCardData(value: string): ParsedCardData {
  const segments = value
    .split(/[\n\r\t,，;；、|]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const parsed: ParsedCardData = {};
  const plainText: string[] = [];

  for (const segment of segments) {
    const labeledName = segment.match(namePattern);
    if (labeledName) {
      parsed.name = labeledName[1].trim();
      continue;
    }

    const labeledTitle = segment.match(titlePattern);
    if (labeledTitle) {
      parsed.title = labeledTitle[1].trim();
      continue;
    }

    let remainder = segment;
    const email = remainder.match(emailPattern)?.[0];
    if (email) {
      parsed.email ||= email;
      remainder = remainder.replace(email, ' ');
    }

    const phone = remainder.match(phonePattern)?.[0]?.trim();
    if (phone) {
      parsed.phone ||= phone;
      remainder = remainder.replace(phone, ' ');
    }

    remainder = remainder.replace(contactPrefixPattern, '').trim();
    if (remainder) plainText.push(remainder);
  }

  parsed.name ||= plainText[0];
  parsed.title ||= plainText[1];
  return parsed;
}
