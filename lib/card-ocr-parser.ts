// OCR contains logos, addresses and footers, unlike the four-field paste box.
// Do not treat its first two lines as a person's name and job title.
const brand =
  /light\s*wheel|光\s*轮\s*智\s*能|有限公司|corporation|\b(?:inc|ltd|llc)\b/i;
const address =
  /地址|北京市|上海市|深圳市|产业园|大厦|\b(?:street|avenue|road|santa clara|augustine|california|suite)\b/i;
const role =
  /经理|总监|工程师|设计师|架构师|专员|主管|总裁|创始人|顾问|助理|负责人|研究员|实习生|市场|商务|运营|销售|人事|行政|财务|\b(?:manager|director|engineer|architect|designer|president|founder|officer|specialist|lead|head|consultant|researcher|intern|ceo|cto|coo|cfo|vp|marketing|sales|operations|recruiter|recruitment|human resources|business development|partnerships|account executive)\b/i;
const contact = /@|https?:|www\.|\.(?:com|ai|cn|net)\b|\d[\d ()+–—-]{6,}\d/i;

export function detectCardTemplate(
  name: string,
  title: string,
  source = '',
): 'chinese' | 'english' | undefined {
  if (/[\u3400-\u9fff]/.test(name + title)) return 'chinese';
  if (/[a-z]{2}/i.test(name + title)) return 'english';
  if (/english|英文/i.test(source)) return 'english';
  if (/chinese|中文/i.test(source)) return 'chinese';
}

export function parseOcrCard(text: string) {
  text = text.normalize('NFKC').replace(/[–—−]/g, '-');
  // Repair spacing around email punctuation, not ambiguous letters or digits.
  const emailText = text.replace(
    /[\w+-]+(?:\s*\.\s*[\w+-]+)*\s*@\s*[\w-]+(?:\s*\.\s*[\w-]+)+/g,
    (value) => value.replace(/\s+/g, ''),
  );
  const email = emailText.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? '';
  const phoneLines = emailText
    .split(/[\r\n]+/)
    .filter((line) => !/linkedin|https?:|www\./i.test(line));
  const phoneCandidates = phoneLines.flatMap((line) =>
    (
      line
        .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '')
        .match(/\+?\d[\d ().-]{5,}\d/g) ?? []
    )
      .map((phone) => phone.trim())
      .filter((phone) => {
        const count = phone.replace(/\D/g, '').length;
        return count >= 7 && count <= 15;
      }),
  );
  const phone =
    phoneCandidates.find((value) => value.startsWith('+')) ??
    phoneCandidates[0] ??
    '';
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
    if (
      brand.test(line) ||
      address.test(line) ||
      contact.test(line) ||
      /linkedin|^来源图片预览$|business-card\.(png|pdf)/i.test(line)
    )
      continue;
    line = line.replace(/^[^\p{L}]+|[^\p{L}.)]+$/gu, '').trim();
    if (/[\u3400-\u9fff]/.test(line))
      line = line.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1');
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
  if (!name && candidates.length > 1 && email) {
    const local = email
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
    phone,
    email,
  };
}

// Preserve reading order and split separate contact columns in PDF text layers.
export function pdfTextLines(
  items: { str: string; transform: number[]; width: number; height: number }[],
) {
  const rows: { y: number; height: number; items: typeof items }[] = [];
  for (const item of [...items].sort(
    (a, b) =>
      b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
  )) {
    if (!item.str.trim()) continue;
    const row = rows.find(
      (row) =>
        Math.abs(row.y - item.transform[5]) <
        Math.max(2, Math.min(row.height, item.height) * 0.4),
    );
    if (row) row.items.push(item);
    else
      rows.push({ y: item.transform[5], height: item.height, items: [item] });
  }
  return rows
    .map((row) => {
      let end = -Infinity;
      return row.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((item, i) => {
          const gap = item.transform[4] - end;
          end = item.transform[4] + item.width;
          return (
            (i
              ? gap > Math.max(18, item.height * 2)
                ? '\n'
                : gap > item.height * 0.15
                  ? ' '
                  : ''
              : '') + item.str
          );
        })
        .join('');
    })
    .join('\n');
}
