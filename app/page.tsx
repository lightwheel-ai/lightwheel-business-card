'use client';
/* oxlint-disable next/no-img-element -- original-resolution assets are captured directly into the exported PDF */

import { type Ref, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Check, Download, FileText, LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { parseCardData } from '@/lib/card-parser';

type Template = 'english' | 'chinese';
type CardData = { name: string; title: string; phone: string; email: string };
type ExportState =
  | 'idle'
  | 'pdf-working'
  | 'png-working'
  | 'pdf-done'
  | 'png-done'
  | 'error';
type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
};

const assetPrefix = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const assetUrl = (path: string) => `${assetPrefix}${path}`;

const defaults: Record<Template, CardData> = {
  english: {
    name: 'Ruiming Zhang',
    title: 'Marketing Director',
    phone: '+86 13800008888',
    email: 'user@lightwheel.ai',
  },
  chinese: {
    name: '张瑞明',
    title: '市场总监',
    phone: '13800008888',
    email: 'user@lightwheel.ai',
  },
};

function BusinessCard({
  template,
  data,
  cardRef,
}: {
  template: Template;
  data: CardData;
  cardRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={cardRef}
      className={`business-card card-${template}`}
      data-template={template}
    >
      <img
        aria-hidden="true"
        className="template-sheet"
        src={assetUrl(`/templates/${template}-template.svg`)}
        alt=""
      />
      <svg
        className="card-overlay"
        viewBox={
          template === 'english' ? '0 0 671.445 825.939' : '0 0 709.87 877.537'
        }
        preserveAspectRatio="none"
      >
        {template === 'english' ? (
          <>
            <rect x="55" y="203" width="276" height="70" fill="#fff" />
            <rect x="86" y="292" width="244" height="71" fill="#fff" />
            <text
              className="english-primary"
              x="61.561"
              y="224.86"
              fill="#143e8d"
              fontFamily="PingFang SC, PingFang TC, sans-serif"
              fontSize="21.0575"
              fontWeight="500"
            >
              {data.name || '—'}
            </text>
            <text
              className="english-primary"
              x="61.561"
              y="249.624"
              fill="#143e8d"
              fontFamily="PingFang SC, PingFang TC, sans-serif"
              fontSize="21.0575"
              fontWeight="500"
            >
              {data.title || '—'}
            </text>
            <text
              className="english-contact"
              x="91.341"
              y="309.528"
              fill="#241c1a"
              fontFamily="PingFang SC, PingFang TC, sans-serif"
              fontSize="14.8641"
              fontWeight="400"
            >
              {data.phone || '—'}
            </text>
            <text
              className="english-contact"
              x="92.0"
              y="345.089"
              fill="#241c1a"
              fontFamily="PingFang SC, PingFang TC, sans-serif"
              fontSize="14.8641"
              fontWeight="400"
            >
              {data.email || '—'}
            </text>
          </>
        ) : (
          <>
            <rect x="55" y="179" width="283" height="103" fill="#fff" />
            <rect x="87" y="310" width="205" height="77" fill="#fff" />
            <text
              className="chinese-primary"
              x="61.073"
              y="206.815"
              fill="#143e8d"
              fontFamily="IBM Plex Sans SC, sans-serif"
              fontSize="28.7562"
              fontWeight="500"
            >
              {data.name || '—'}
            </text>
            <text
              className="chinese-primary"
              x="60.187"
              y="258.162"
              fill="#143e8d"
              fontFamily="IBM Plex Sans SC, sans-serif"
              fontSize="28.7562"
              fontWeight="500"
            >
              {data.title || '—'}
            </text>
            <text
              className="chinese-contact"
              x="92.131"
              y="329.114"
              fill="#241c1a"
              fontFamily="IBM Plex Sans SC, sans-serif"
              fontSize="14.5"
              fontWeight="400"
            >
              {data.phone || '—'}
            </text>
            <text
              className="chinese-contact"
              x="93.306"
              y="367.037"
              fill="#241c1a"
              fontFamily="IBM Plex Sans SC, sans-serif"
              fontSize="14.5"
              fontWeight="400"
            >
              {data.email || '—'}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export default function Home() {
  const [template, setTemplate] = useState<Template>('chinese');
  const [values, setValues] = useState<Record<Template, CardData>>(defaults);
  const [bulk, setBulk] = useState('');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const exportRef = useRef<HTMLDivElement>(null);
  const data = values[template];
  const templateLabel = useMemo(
    () => (template === 'english' ? '英文名片预览' : '中文名片预览'),
    [template],
  );
  const isExporting =
    exportState === 'pdf-working' || exportState === 'png-working';

  function update(field: keyof CardData, value: string) {
    setValues((current) => ({
      ...current,
      [template]: { ...current[template], [field]: value },
    }));
  }

  function recognize(value: string) {
    setBulk(value);
    const parsed = parseCardData(value);

    setValues((current) => ({
      ...current,
      [template]: {
        name: parsed.name ?? defaults[template].name,
        title: parsed.title ?? defaults[template].title,
        phone: parsed.phone ?? defaults[template].phone,
        email: parsed.email ?? defaults[template].email,
      },
    }));
  }

  function safeFileName() {
    return (data.name || 'Lightwheel').trim().replace(/[\\/:*?"<>|]+/g, '-');
  }

  async function renderCard() {
    if (!exportRef.current) throw new Error('Export card is not ready.');
    await document.fonts.ready;
    return toPng(exportRef.current, {
      cacheBust: true,
      pixelRatio: 3.2,
      backgroundColor: '#ffffff',
    });
  }

  function selectSaveLocation(
    fileName: string,
    description: string,
    mimeType: string,
    extension: string,
  ): Promise<FileSystemFileHandle | undefined> {
    const savePicker = (window as SavePickerWindow).showSaveFilePicker;

    if (savePicker) {
      return savePicker.call(window, {
        suggestedName: fileName,
        types: [
          {
            description,
            accept: { [mimeType]: [extension] },
          },
        ],
      });
    }

    return Promise.resolve(undefined);
  }

  async function saveBlob(
    blob: Blob,
    fileName: string,
    fileHandle?: FileSystemFileHandle,
  ) {
    if (fileHandle) {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleExportError(error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      setExportState('idle');
      return;
    }
    console.error(error);
    setExportState('error');
  }

  async function exportPdf() {
    if (!exportRef.current || isExporting) return;

    setExportState('pdf-working');
    try {
      const fileName = `${safeFileName()}-${template}-business-card.pdf`;
      const fileHandle = await selectSaveLocation(
        fileName,
        '矢量 PDF 文件',
        'application/pdf',
        '.pdf',
      );
      const { createVectorCardPdf } = await import('@/lib/vector-pdf');
      const pdf = await createVectorCardPdf({ template, data, assetUrl });
      await saveBlob(pdf, fileName, fileHandle);
      setExportState('pdf-done');
      window.setTimeout(() => setExportState('idle'), 2200);
    } catch (error) {
      handleExportError(error);
    }
  }

  async function exportPng() {
    if (!exportRef.current || isExporting) return;

    setExportState('png-working');
    try {
      const fileName = `${safeFileName()}-${template}-business-card.png`;
      const fileHandle = await selectSaveLocation(
        fileName,
        'PNG 图片',
        'image/png',
        '.png',
      );
      const image = await renderCard();
      const imageBlob = await fetch(image).then((response) => response.blob());
      await saveBlob(imageBlob, fileName, fileHandle);
      setExportState('png-done');
      window.setTimeout(() => setExportState('idle'), 2200);
    } catch (error) {
      handleExportError(error);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f5f8] text-[#172033]">
      <header className="border-b border-[#dfe4ec] bg-white">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <img
              src={assetUrl('/lightwheel.svg')}
              alt="Lightwheel"
              className="h-7 w-auto"
            />
            <span className="hidden h-5 w-px bg-[#dfe4ec] sm:block" />
            <span className="hidden text-sm font-medium text-[#697386] sm:block">
              Business Card
            </span>
          </div>
          <span className="rounded-full bg-[#eef3ff] px-3 py-1.5 text-xs font-medium text-[#17428f]">
            实时预览
          </span>
        </div>
      </header>

      <div className="workspace-grid mx-auto grid max-w-[1480px] gap-5 px-5 py-5 lg:grid-cols-2 lg:px-8">
        <section className="editor-panel">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-[-0.025em]">
              自动生成名片
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#697386]">
              输入信息后，模板将自动同步。也可以粘贴整段信息进行识别。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">模板</Label>
            <NativeSelect
              id="template"
              className="w-full"
              value={template}
              onChange={(event) => setTemplate(event.target.value as Template)}
            >
              <NativeSelectOption value="chinese">中文模板</NativeSelectOption>
              <NativeSelectOption value="english">英文模板</NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="mt-5">
            <Textarea
              aria-label="智能识别"
              value={bulk}
              onChange={(event) => recognize(event.target.value)}
              placeholder={
                '智能识别：输入或粘贴姓名、职位、电话和邮箱\n支持用换行或逗号分隔，将自动填入下方'
              }
              className="min-h-48 resize-none rounded-2xl border-2 border-[#afc0e2] bg-[#f4f7ff] px-5 py-4 text-base leading-7 shadow-[0_10px_28px_rgba(23,66,143,0.08)]"
            />
          </div>

          <div className="my-5 h-px bg-[#e5e9f0]" />

          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['name', '名字'],
                ['title', '职位'],
                ['phone', '电话'],
                ['email', '邮箱'],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={field}>{label}</Label>
                <Input
                  id={field}
                  value={data[field]}
                  onChange={(event) => update(field, event.target.value)}
                  className="h-10 bg-white"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              className="h-11 bg-[#17428f] text-white"
              onClick={exportPdf}
              disabled={isExporting}
            >
              {exportState === 'pdf-working' ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : exportState === 'pdf-done' ? (
                <Check className="size-4" />
              ) : (
                <Download className="size-4" />
              )}
              {exportState === 'pdf-working'
                ? '正在生成…'
                : exportState === 'pdf-done'
                  ? '已下载'
                  : '矢量 PDF 下载'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 bg-white"
              onClick={exportPng}
              disabled={isExporting}
            >
              {exportState === 'png-working' ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : exportState === 'png-done' ? (
                <Check className="size-4" />
              ) : (
                <Download className="size-4" />
              )}
              {exportState === 'png-working'
                ? '正在生成…'
                : exportState === 'png-done'
                  ? '已下载'
                  : 'PNG下载'}
            </Button>
          </div>
          {exportState === 'error' && (
            <p className="mt-2 text-center text-xs text-[#b4232f]">
              生成失败，请刷新页面后重试。
            </p>
          )}
          <p className="mt-3 text-center text-xs leading-5 text-[#697386]">
            PDF 全部转曲且不含位图；PNG 为 3.2 倍高清输出
            <br />
            下载时会弹出保存位置选择（不支持时按浏览器设置下载）
          </p>
        </section>

        <section className="preview-panel">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{templateLabel}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#697386]">
              <FileText className="size-4" />
              完整名片 · 转曲 PDF / 高清 PNG
            </div>
          </div>
          <div className="preview-stage">
            <div className="preview-item">
              <BusinessCard template={template} data={data} />
            </div>
          </div>
        </section>
      </div>

      <div className="export-rack" aria-hidden="true">
        <BusinessCard template={template} data={data} cardRef={exportRef} />
      </div>
    </main>
  );
}
