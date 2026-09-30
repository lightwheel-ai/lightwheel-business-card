import { createCardImporter, parseCsv, cardsFromRows } from '../lib/card-import';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Workbook } from 'exceljs';
const result = document.querySelector<HTMLPreElement>('#result')!;
const csv = '姓名,职位,电话,邮箱\r\nTest Person,"Director, Product",+86 13800008888,user@example.com';
function assert(ok: unknown, message: string) { if (!ok) throw new Error(message); }
document.querySelector('#run')!.addEventListener('click', async () => {
  const importer = createCardImporter(new AbortController().signal, text => result.textContent += `\n${text}`);
  result.textContent = '开始…';
  try {
    const rows = cardsFromRows(parseCsv(csv), 'test.csv');
    assert(rows[0].title === 'Director, Product', '带逗号 CSV 解析失败');
    const book = new Workbook(); book.addWorksheet('名片').addRows([['姓名', '职位', '电话', '邮箱'], ['Test Person', 'Product Director', '+86 13800008888', 'user@example.com']]);
    const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica); const page = pdf.addPage([400, 220]);
    ['Test Person', 'Product Director', '+86 13800008888', 'user@example.com'].forEach((text, i) => page.drawText(text, { font, size: 18, x: 25, y: 180 - i * 35 }));
    for (const file of [new File([csv], 'test.csv'), new File([await book.xlsx.writeBuffer()], 'test.xlsx'), new File([await pdf.save() as Uint8Array<ArrayBuffer>], 'test.pdf')]) {
      const cards = []; for await (const card of importer.read(file)) cards.push(card);
      assert(cards.length === 1 && cards[0].email === 'user@example.com', `${file.name} 解析错误`);
      result.textContent += `\nPASS ${file.name}: ${JSON.stringify(cards[0])}`;
    }
    const cancel = new AbortController(); cancel.abort(); const stopped = createCardImporter(cancel.signal, () => {});
    let rejected = false; try { for await (const _ of stopped.read(new File([csv], 'test.csv'))) { /* no output expected */ } } catch { rejected = true; }
    assert(rejected, '取消检查失败'); await stopped.close(); result.textContent += '\nPASS 取消导入';
  } catch (e) { result.textContent += `\nFAIL ${String(e)}`; } finally { await importer.close(); }
});
document.querySelector('#ocr')!.addEventListener('click', async () => {
  const importer = createCardImporter(new AbortController().signal, text => result.textContent = text);
  try {
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 500;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1000, 500); ctx.fillStyle = '#111'; ctx.font = '40px Arial';
    ['Test Person', 'Product Director', '+86 13800008888', 'user@example.com'].forEach((text, i) => ctx.fillText(text, 60, 100 + i * 85));
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
    for await (const card of importer.read(new File([blob], 'test.png'))) { assert(card.email === 'user@example.com', '图片邮箱识别失败'); result.textContent = `PASS 图片识别\n${JSON.stringify(card)}`; }
  } catch (e) { result.textContent = `FAIL ${String(e)}`; } finally { await importer.close(); }
});
