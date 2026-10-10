import { createWorker, PSM } from 'tesseract.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOcrCard, detectCardTemplate } from '../lib/card-ocr-parser.ts';
const input = process.argv[2];
if (!input) throw new Error('Provide an image path');
const cachePath = await mkdtemp(join(tmpdir(), 'card-ocr-check-'));
const worker = await createWorker('chi_sim+eng', 1, { cachePath });
try {
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: '1',
  });
  const { data } = await worker.recognize(input);
  const fields = parseOcrCard(data.text);
  console.log(
    JSON.stringify(
      {
        fields,
        template: detectCardTemplate(fields.name, fields.title),
        text: data.text,
      },
      null,
      2,
    ),
  );
} finally {
  await worker.terminate();
}
