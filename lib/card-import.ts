import {
  parseOcrCard,
  detectCardTemplate,
  pdfTextLines,
} from './card-ocr-parser';

export type ImportedCard = {
  name: string;
  title: string;
  phone: string;
  email: string;
  source: string;
  preview?: Blob;
  template?: 'chinese' | 'english';
};
const aliases = {
  name: ['姓名', '名字', 'name', 'fullname', 'full name'],
  title: ['职位', '职务', 'title', 'position', 'job title', 'role'],
  phone: ['电话', '手机', '手机号', 'phone', 'telephone', 'tel', 'mobile'],
  email: ['邮箱', '电子邮箱', 'email', 'e-mail', 'mail'],
};
const keys = Object.keys(aliases) as (keyof typeof aliases)[];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  text = text.replace(/^\uFEFF/, '');
  const delimiter = text.split(/\r?\n/, 1)[0].includes('\t') ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell) quoted = !quoted;
      else cell += c;
    } else if (!quoted && (c === delimiter || c === '\n' || c === '\r')) {
      row.push(cell);
      cell = '';
      if (c !== delimiter) {
        rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else cell += c;
  }
  if (quoted) throw new Error('CSV 引号未闭合，请检查表格。');
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function cardsFromRows(
  rows: string[][],
  source: string,
): ImportedCard[] {
  const headerIndex = rows.findIndex((row) =>
    keys.every((key) =>
      row.some((cell) => aliases[key].includes(cell.trim().toLowerCase())),
    ),
  );
  if (headerIndex < 0)
    throw new Error('表格需包含姓名、职位、电话、邮箱四列（支持英文表头）。');
  const header = rows[headerIndex].map((cell) => cell.trim().toLowerCase());
  const columns = Object.fromEntries(
    keys.map((key) => [
      key,
      header.findIndex((cell) => aliases[key].includes(cell)),
    ]),
  ) as Record<keyof typeof aliases, number>;
  const cards = rows
    .slice(headerIndex + 1)
    .map((row, i) => ({
      name: row[columns.name]?.trim() ?? '',
      title: row[columns.title]?.trim() ?? '',
      phone: row[columns.phone]?.trim() ?? '',
      email: row[columns.email]?.trim() ?? '',
      source: `${source} · 第 ${headerIndex + i + 2} 行`,
      template: detectCardTemplate(
        row[columns.name] ?? '',
        row[columns.title] ?? '',
        source,
      ),
    }))
    .filter((row) => keys.some((key) => row[key]));
  if (cards.length > 500)
    throw new Error('每个表格最多导入 500 条，请拆分后重试。');
  return cards;
}

export function createCardImporter(
  signal: AbortSignal,
  progress: (text: string) => void,
) {
  let worker: import('tesseract.js').Worker | undefined;
  const check = () => {
    if (signal.aborted) throw new Error('导入已停止');
  };
  const cancel = () => {
    void worker?.terminate();
    worker = undefined;
  };
  signal.addEventListener('abort', cancel, { once: true });
  async function recognize(image: File | HTMLCanvasElement) {
    check();
    if (!worker) {
      progress('首次识别正在下载中英文语言包…');
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker('chi_sim+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text')
            progress(`正在识别文字 ${Math.round(m.progress * 100)}%`);
        },
      });
      if (signal.aborted) {
        cancel();
        check();
      }
    }
    await worker!.setParameters({
      tessedit_pageseg_mode: '11' as import('tesseract.js').PSM,
      preserve_interword_spaces: '1',
    });
    const { data } = await worker!.recognize(image);
    check();
    return data.text;
  }
  function fromText(text: string, source: string): ImportedCard {
    if (!text.trim())
      throw new Error('未识别到文字，请使用清晰、正向的名片图片。');
    const card = parseOcrCard(text);
    return {
      name: card.name ?? '',
      title: card.title ?? '',
      phone: card.phone ?? '',
      email: card.email ?? '',
      source,
      template: detectCardTemplate(card.name, card.title, source),
    };
  }
  return {
    async *read(file: File): AsyncGenerator<ImportedCard> {
      check();
      if (file.size > 20 * 1024 * 1024)
        throw new Error('单个文件不能超过 20 MB。');
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['csv', 'tsv'].includes(ext ?? '')) {
        for (const row of cardsFromRows(
          parseCsv(await file.text()),
          file.name,
        )) {
          check();
          yield row;
        }
      } else if (ext === 'xlsx') {
        const { Workbook } = await import('exceljs');
        const book = new Workbook();
        await book.xlsx.load(await file.arrayBuffer());
        check();
        let count = 0;
        for (const sheet of book.worksheets) {
          const rows: string[][] = [];
          sheet.eachRow((row) => {
            const cells: string[] = [];
            row.eachCell({ includeEmpty: true }, (cell, col) => {
              cells[col - 1] = cell.text;
            });
            rows.push(cells);
          });
          if (!rows.length) continue;
          const cards = cardsFromRows(rows, `${file.name} / ${sheet.name}`);
          count += cards.length;
          if (count > 500) throw new Error('工作簿最多导入 500 条。');
          for (const card of cards) {
            check();
            yield card;
          }
        }
      } else if (ext === 'pdf') {
        const pdf = await import('pdfjs-dist');
        pdf.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).href;
        const task = pdf.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
        });
        const abort = () => {
          void task.destroy();
        };
        signal.addEventListener('abort', abort, { once: true });
        try {
          const doc = await task.promise;
          if (doc.numPages > 30)
            throw new Error('每份 PDF 最多 30 页，请拆分后重试。');
          for (let i = 1; i <= doc.numPages; i++) {
            check();
            progress(`读取 PDF 第 ${i} / ${doc.numPages} 页`);
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            let text = pdfTextLines(
              content.items.filter((item) => 'str' in item),
            );
            {
              const viewport = page.getViewport({
                scale: Math.min(3, 2400 / Math.max(page.view[2], page.view[3])),
              });
              const canvas = document.createElement('canvas');
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              await page.render({ canvas, viewport }).promise;
              const native = parseOcrCard(text);
              // Outlined and partially outlined PDFs can retain only the address/email.
              // Their non-empty text layer must not prevent OCR of the actual card.
              if (
                !native.name ||
                !native.title ||
                !native.email ||
                !native.phone
              ) {
                const scanned = await recognize(canvas);
                const ocr = parseOcrCard(scanned);
                text = [
                  native.name || ocr.name
                    ? `姓名: ${native.name || ocr.name}`
                    : '',
                  native.title || ocr.title
                    ? `职位: ${native.title || ocr.title}`
                    : '',
                  native.phone || ocr.phone,
                  native.email || ocr.email,
                ]
                  .filter(Boolean)
                  .join('\n');
              }
              const preview = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/png'),
              );
              yield {
                ...fromText(text, `${file.name} · 第 ${i} 页`),
                preview: preview ?? undefined,
              };
              canvas.width = 0;
              canvas.height = 0;
            }
            page.cleanup();
          }
        } finally {
          signal.removeEventListener('abort', abort);
          await task.destroy();
        }
      } else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext ?? '')) {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        const scale = Math.min(3, 2600 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.ceil(bitmap.width * scale);
        canvas.height = Math.ceil(bitmap.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        try {
          const text = await recognize(canvas);
          const preview = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/png'),
          );
          yield { ...fromText(text, file.name), preview: preview ?? undefined };
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      } else
        throw new Error(
          '支持 PNG、JPG、WebP、BMP、PDF、XLSX、CSV、TSV；旧版 XLS 请另存为 XLSX。',
        );
    },
    async close() {
      signal.removeEventListener('abort', cancel);
      await worker?.terminate();
      worker = undefined;
    },
  };
}
