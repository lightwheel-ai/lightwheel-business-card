import fontkit from '@pdf-lib/fontkit';
import { cmyk, PDFDocument, type PDFPage } from 'pdf-lib';

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

const englishBlue = cmyk(1, 0.8984375, 0.1796875, 0);
const englishPhone = cmyk(0, 0, 0, 1);
const englishEmail = cmyk(0.78515625, 0.81640625, 0.83203125, 0.671875);
const chineseBlue = cmyk(
  1,
  0.909391939640045,
  0.207156479358673,
  0.0699473544955254,
);
const chinesePhone = cmyk(
  0.639917612075806,
  0.692744314670563,
  0.688105583190918,
  0.788204789161682,
);
const chineseEmail = cmyk(
  0.641779184341431,
  0.693904042243958,
  0.688349723815918,
  0.794003188610077,
);

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
  color: ReturnType<typeof cmyk>,
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
  color: ReturnType<typeof cmyk>,
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
      22.560755,
      88.478121,
      8.50002,
      englishBlue,
    );
    drawPathFaceText(
      page,
      pingFang.medium,
      data.title,
      22.560755,
      98.678121,
      8.50002,
      englishBlue,
    );
    drawPathFaceText(
      page,
      pingFang.regular,
      data.phone,
      34.581751,
      122.654879,
      6.00001,
      englishPhone,
    );
    drawPathFaceText(
      page,
      pingFang.regular,
      data.email,
      34.882044,
      137.009371,
      6.00001,
      englishEmail,
    );
  } else {
    const ibm = await loadIbmFonts();
    drawFontkitText(
      page,
      ibm.medium,
      data.name,
      22.924303,
      77.630152,
      10.79394,
      chineseBlue,
    );
    drawFontkitText(
      page,
      ibm.medium,
      data.title,
      22.591295,
      96.902613,
      10.79394,
      chineseBlue,
    );
    drawFontkitText(
      page,
      ibm.regular,
      data.phone,
      34.582506,
      123.535425,
      5.44272,
      chinesePhone,
    );
    drawFontkitText(
      page,
      ibm.regular,
      data.email,
      35.022936,
      137.7698,
      5.44272,
      chineseEmail,
    );
  }

  const bytes = await document.save();
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}
