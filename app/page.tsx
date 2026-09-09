'use client';
/* oxlint-disable next/no-img-element -- original-resolution assets are captured directly into the exported PDF */

import { type Ref, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  Check,
  Download,
  FileText,
  LoaderCircle,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

type Template = 'english' | 'chinese';
type CardData = { name: string; title: string; phone: string; email: string };
type ExportState =
  | 'idle'
  | 'pdf-working'
  | 'png-working'
  | 'pdf-done'
  | 'png-done'
  | 'error';

const assetPrefix = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const assetUrl = (path: string) => `${assetPrefix}${path}`;

const defaults: Record<Template, CardData> = {
  english: {
    name: '名字',
    title: '职位',
    phone: '+86 175 12561273',
    email: 'user@lightwheel.ai',
  },
  chinese: {
    name: '名字',
    title: '职位',
    phone: '+86 175 12561273',
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
        src={assetUrl(`/templates/${template}-template.png`)}
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
            <rect x="87" y="310" width="245" height="77" fill="#fff" />
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
  const [template, setTemplate] = useState<Template>('english');
  const [values, setValues] = useState<Record<Template, CardData>>(defaults);
  const [bulk, setBulk] = useState('');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const exportRef = useRef<HTMLDivElement>(null);
  const data = values[template];
  const templateLabel = useMemo(
    () => (template === 'english' ? '英文模板' : '中文模板'),
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
    const lines = value
      .split(/\n|\r|\t|[;；]/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return;

    const extractLabeled = (labels: string[]) => {
      const pattern = new RegExp(
        `^(?:${labels.join('|')})\\s*[:：]\\s*(.+)$`,
        'i',
      );
      return lines
        .map((line) => line.match(pattern)?.[1]?.trim())
        .find(Boolean);
    };
    const email = value.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
    const phone = value.match(/(?:\+?\d[\d\s()–—-]{6,}\d)/)?.[0]?.trim();
    const labeledName = extractLabeled(['姓名', '名字', 'name']);
    const labeledTitle = extractLabeled(['职位', '职务', 'title', 'position']);
    const plain = lines
      .filter((line) => !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(line))
      .filter((line) => !/(?:\+?\d[\d\s()–—-]{6,}\d)/.test(line))
      .filter(
        (line) =>
          !/^(?:姓名|名字|name|职位|职务|title|position)\s*[:：]/i.test(line),
      );

    setValues((current) => ({
      ...current,
      [template]: {
        name: labeledName || plain[0] || current[template].name,
        title: labeledTitle || plain[1] || current[template].title,
        phone: phone || current[template].phone,
        email: email || current[template].email,
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
      pixelRatio: 2.4,
      backgroundColor: '#ffffff',
    });
  }

  async function exportPdf() {
    if (!exportRef.current || isExporting) return;

    setExportState('pdf-working');
    try {
      const image = await renderCard();
      const ratio =
        template === 'english' ? 671.445 / 825.939 : 709.87 / 877.537;
      const width = 90;
      const height = width / ratio;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [width, height],
        compress: true,
      });
      pdf.addImage(image, 'PNG', 0, 0, width, height, undefined, 'FAST');
      pdf.save(`${safeFileName()}-${template}-business-card.pdf`);
      setExportState('pdf-done');
      window.setTimeout(() => setExportState('idle'), 2200);
    } catch (error) {
      console.error(error);
      setExportState('error');
    }
  }

  async function exportPng() {
    if (!exportRef.current || isExporting) return;

    setExportState('png-working');
    try {
      const image = await renderCard();
      const link = document.createElement('a');
      link.download = `${safeFileName()}-${template}-business-card.png`;
      link.href = image;
      link.click();
      setExportState('png-done');
      window.setTimeout(() => setExportState('idle'), 2200);
    } catch (error) {
      console.error(error);
      setExportState('error');
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
            Live preview
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-5 px-5 py-5 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-8">
        <section className="editor-panel">
          <div className="mb-6">
            <p className="eyebrow">Card details</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
              生成 Lightwheel 名片
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
              <NativeSelectOption value="english">英文模板</NativeSelectOption>
              <NativeSelectOption value="chinese">中文模板</NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="mt-5 rounded-xl border border-[#dbe3f2] bg-[#f7f9fd] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#17428f]">
              <Sparkles className="size-4" />
              智能识别
            </div>
            <Textarea
              value={bulk}
              onChange={(event) => recognize(event.target.value)}
              placeholder={
                '输入或粘贴姓名、职位、电话和邮箱\n每项一行，下方会自动填入'
              }
              className="min-h-24 resize-none bg-white"
            />
          </div>

          <div className="my-5 h-px bg-[#e5e9f0]" />

          <div className="grid gap-4">
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
                  : 'PDF下载'}
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
        </section>

        <section className="preview-panel">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Preview</p>
              <h2 className="mt-1 text-xl font-semibold">{templateLabel}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#697386]">
              <FileText className="size-4" />
              完整名片 · PDF / PNG
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
