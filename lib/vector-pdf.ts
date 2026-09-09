import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFPage, rgb } from 'pdf-lib';

type Template = 'english' | 'chinese';
type CardData = { name: string; title: string; phone: string; email: string };

type FontkitCommand = {
  command:
    | 'moveTo'
    | 'lineTo'
    | 'quadraticCurveTo'
    | 'bezierCurveTo'
    | 'closePath';
  args: number[];
};

type FontkitFont = {
  unitsPerEm: number;
  layout: (text: string) => {
    glyphs: Array<{ path: { commands: FontkitCommand[] } }>;
    positions: Array<{
      xAdvance: number;
      yAdvance: number;
      xOffset: number;
      yOffset: number;
    }>;
  };
};

type PathFace = {
  unitsPerEm: number;
  glyphs: Record<string, { path: string; advance: number }>;
};

type PingFangPaths = { medium: PathFace; regular: PathFace };

const blue = rgb(20 / 255, 62 / 255, 141 / 255);
const nearBlack = rgb(36 / 255, 28 / 255, 26 / 255);

const ibmMediumUrl = new URL(
  '../app/fonts/IBMPlexSansSC-Medium.otf',
  import.meta.url,
).href;
const ibmRegularUrl = new URL(
  '../app/fonts/IBMPlexSansSC-Regular.otf',
  import.meta.url,
).href;

let ibmFontsPromise:
  | Promise<{ medium: FontkitFont; regular: FontkitFont }>
  | undefined;
let pingFangPromise: Promise<PingFangPaths> | undefined;

function rounded(value: number) {
  return Number(value.toFixed(3)).toString();
}

function pointPair(args: number[], offset: number) {
  return `${rounded(args[offset])} ${rounded(-args[offset + 1])}`;
}

function commandsToSvgPath(commands: FontkitCommand[]) {
  return commands
    .map(({ command, args }) => {
      switch (command) {
        case 'moveTo':
          return `M${pointPair(args, 0)}`;
        case 'lineTo':
          return `L${pointPair(args, 0)}`;
        case 'quadraticCurveTo':
          return `Q${pointPair(args, 0)} ${pointPair(args, 2)}`;
        case 'bezierCurveTo':
          return `C${pointPair(args, 0)} ${pointPair(args, 2)} ${pointPair(args, 4)}`;
        case 'closePath':
          return 'Z';
      }
    })
    .join('');
}

async function loadIbmFonts() {
  ibmFontsPromise ||= Promise.all([
    fetch(ibmMediumUrl).then((response) => response.arrayBuffer()),
    fetch(ibmRegularUrl).then((response) => response.arrayBuffer()),
  ]).then(([mediumBytes, regularBytes]) => ({
    medium: fontkit.create(
      new Uint8Array(mediumBytes),
    ) as unknown as FontkitFont,
    regular: fontkit.create(
      new Uint8Array(regularBytes),
    ) as unknown as FontkitFont,
  }));
  return ibmFontsPromise;
}

async function loadPingFangPaths(assetUrl: (path: string) => string) {
  pingFangPromise ||= fetch(assetUrl('/templates/pingfang-paths.json')).then(
    async (response) => {
      if (!response.ok) throw new Error('Unable to load PingFang outlines.');
      return (await response.json()) as PingFangPaths;
    },
  );
  return pingFangPromise;
}

function drawFontkitText(
  page: PDFPage,
  font: FontkitFont,
  text: string,
  x: number,
  baselineFromTop: number,
  fontSize: number,
  color: ReturnType<typeof rgb>,
) {
  const run = font.layout(text || '—');
  const scale = fontSize / font.unitsPerEm;
  let cursor = x;

  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index];
    const path = commandsToSvgPath(glyph.path.commands);
    if (path) {
      page.drawSvgPath(path, {
        x: cursor + position.xOffset * scale,
        y: page.getHeight() - baselineFromTop + position.yOffset * scale,
        scale,
        color,
      });
    }
    cursor += position.xAdvance * scale;
  });
}

function drawPathFaceText(
  page: PDFPage,
  face: PathFace,
  text: string,
  x: number,
  baselineFromTop: number,
  fontSize: number,
  color: ReturnType<typeof rgb>,
) {
  const scale = fontSize / face.unitsPerEm;
  let cursor = x;

  for (const character of text || '—') {
    const glyph = face.glyphs[character] ?? face.glyphs['?'];
    if (glyph?.path) {
      page.drawSvgPath(glyph.path, {
        x: cursor,
        y: page.getHeight() - baselineFromTop,
        scale,
        color,
      });
    }
    cursor += (glyph?.advance ?? face.unitsPerEm * 0.6) * scale;
  }
}

export async function createVectorCardPdf({
  template,
  data,
  assetUrl,
}: {
  template: Template;
  data: CardData;
  assetUrl: (path: string) => string;
}) {
  const templateResponse = await fetch(
    assetUrl(`/templates/${template}-template-outlined.pdf`),
  );
  if (!templateResponse.ok) throw new Error('Unable to load vector template.');

  const document = await PDFDocument.load(await templateResponse.arrayBuffer());
  const page = document.getPages()[0];

  if (template === 'english') {
    const pingFang = await loadPingFangPaths(assetUrl);
    drawPathFaceText(
      page,
      pingFang.medium,
      data.name,
      61.561,
      224.86,
      21.0575,
      blue,
    );
    drawPathFaceText(
      page,
      pingFang.medium,
      data.title,
      61.561,
      249.624,
      21.0575,
      blue,
    );
    drawPathFaceText(
      page,
      pingFang.regular,
      data.phone,
      91.341,
      309.528,
      14.8641,
      nearBlack,
    );
    drawPathFaceText(
      page,
      pingFang.regular,
      data.email,
      92,
      345.089,
      14.8641,
      nearBlack,
    );
  } else {
    const ibm = await loadIbmFonts();
    drawFontkitText(
      page,
      ibm.medium,
      data.name,
      61.073,
      206.815,
      28.7562,
      blue,
    );
    drawFontkitText(
      page,
      ibm.medium,
      data.title,
      60.187,
      258.162,
      28.7562,
      blue,
    );
    drawFontkitText(
      page,
      ibm.regular,
      data.phone,
      92.131,
      329.114,
      14.5,
      nearBlack,
    );
    drawFontkitText(
      page,
      ibm.regular,
      data.email,
      93.306,
      367.037,
      14.5,
      nearBlack,
    );
  }

  const bytes = await document.save();
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}
