export type ImageTextLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stretch: number;
};

export type ImageText = {
  width: number;
  height: number;
  text: string;
  lines: ImageTextLine[];
};

export async function recognizeSourceImage(
  src: string,
  signal: AbortSignal,
  progress: (message: string) => void,
): Promise<ImageText> {
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error('原图读取失败');
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  const scale = Math.min(2, 2600 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('无法读取图片');
  }
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let worker: import('tesseract.js').Worker | undefined;
  const cancel = () => void worker?.terminate().catch(() => {});
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    const { createWorker, PSM } = await import('tesseract.js');
    worker = await createWorker(['eng', 'chi_sim'], 1, {
      logger: (event) => {
        if (!signal.aborted && event.status === 'recognizing text') {
          progress(`正在准备可复制文字 ${Math.round(event.progress * 100)}%`);
        }
      },
    });
    signal.throwIfAborted();
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    signal.throwIfAborted();
    const lines = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.flatMap((line) => {
          const text = line.text.trim();
          const { x0, y0, x1, y1 } = line.bbox;
          context.font = `${y1 - y0}px Arial`;
          const measuredWidth = context.measureText(text).width;
          return text && x1 > x0 && y1 > y0
            ? [
                {
                  text,
                  x: x0,
                  y: y0,
                  width: x1 - x0,
                  height: y1 - y0,
                  stretch: measuredWidth > 0 ? (x1 - x0) / measuredWidth : 1,
                },
              ]
            : [];
        }),
      ),
    );
    return {
      width: canvas.width,
      height: canvas.height,
      text: data.text.trim(),
      lines,
    };
  } finally {
    signal.removeEventListener('abort', cancel);
    await worker?.terminate().catch(() => {});
    canvas.width = 0;
    canvas.height = 0;
  }
}
