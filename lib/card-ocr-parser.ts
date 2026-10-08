import { parseCardData } from './card-parser.ts';

// OCR contains logos, addresses and footers, unlike the four-field paste box.
// Do not treat its first two lines as a person's name and job title.
const brand =
  /light\s*wheel|光\s*轮\s*智\s*能|有限公司|corporation|\b(?:inc|ltd|llc)\b/i;
const address =
  /地址|北京市|上海市|深圳市|产业园|大厦|\b(?:street|avenue|road|santa clara|augustine|california|suite)\b/i;
const role =
  /经理|总监|工程师|设计师|架构师|专员|主管|总裁|创始人|顾问|助理|负责人|研究员|实习生|\b(?:manager|director|engineer|architect|designer|president|founder|officer|specialist|lead|head|consultant|researcher|intern|ceo|cto|coo|cfo|vp)\b/i;
const contact = /@|https?:|www\.|\.(?:com|ai|cn|net)\b|\d[\d ()+–—-]{6,}\d/i;

export function parseOcrCard(text: string) {
  const contacts = parseCardData(text);
  const lines = text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  let name = '',
    title = '';
  const candidates: string[] = [];
  for (let line of lines) {
    const named = line.match(/^(?:姓名|名字|name)\s*[:：]\s*(.+)$/i);
    const titled = line.match(
      /^(?:职位|职务|title|position|role)\s*[:：]\s*(.+)$/i,
    );
    if (named) {
      name = named[1].trim();
      continue;
    }
    if (titled) {
      title = titled[1].trim();
      continue;
    }
    if (brand.test(line) || address.test(line) || contact.test(line)) continue;
    line = line.replace(/^[^\p{L}]+|[^\p{L}.)]+$/gu, '').trim();
    if (!line) continue;
    if (role.test(line)) {
      title ||= line;
      continue;
    }
    // Chinese OCR often inserts spaces between individual characters.
    const compact = line.replace(/\s+/g, '');
    if (/^[\u3400-\u9fff·]{2,6}$/.test(compact)) candidates.push(compact);
    else if (
      /^[A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*(?:\s+[A-Za-zÀ-ž][A-Za-zÀ-ž.'’-]*){1,4}$/.test(
        line,
      )
    )
      candidates.push(line);
  }
  if (!name && candidates.length === 1) name = candidates[0];
  if (!name && candidates.length > 1 && contacts.email) {
    const local = contacts.email
      .split('@')[0]
      .replace(/[^a-z]/gi, '')
      .toLowerCase();
    const matches = candidates.filter((candidate) =>
      candidate
        .split(/\s+/)
        .some((part) => part.length > 2 && local.includes(part.toLowerCase())),
    );
    if (matches.length === 1) name = matches[0];
  }
  return {
    name,
    title,
    phone: contacts.phone ?? '',
    email: contacts.email ?? '',
  };
}
