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

const defaults: Record<Template, CardData> = {
  english: {
    name: 'Feng Mao',
    title: 'CFO',
    phone: '+86–13661977393',
    email: 'feng.mao@lightwheel.ai',
  },
  chinese: {
    name: '金朱钢',
    title: '投融资总监',
    phone: '15810997659',
    email: 'zhugang.jin@lightwheel.ai',
  },
};

function BusinessCard({
  template,
  side,
  data,
  cardRef,
}: {
  template: Template;
  side: 'front' | 'back';
  data: CardData;
  cardRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={cardRef}
      className={`business-card card-${template}`}
      data-template={template}
      data-side={side}
    >
      <img
        aria-hidden="true"
        className={`template-sheet ${side === 'back' ? 'template-sheet-back' : ''}`}
        src={`/templates/${template}-template.png`}
        alt=""
      />
      {side === 'front' && (
        <>
          <span className="text-mask mask-name" />
          <span className="text-mask mask-contact" />
          <div className="card-name">{data.name || '—'}</div>
          <div className="card-title">{data.title || '—'}</div>
          <div className="card-phone">{data.phone || '—'}</div>
          <div className="card-email">{data.email || '—'}</div>
        </>
      )}
    </div>
  );
}

export default function Home() {
  const [template, setTemplate] = useState<Template>('english');
  const [values, setValues] = useState<Record<Template, CardData>>(defaults);
  const [bulk, setBulk] = useState('');
  const [exportState, setExportState] = useState<
    'idle' | 'working' | 'done' | 'error'
  >('idle');
  const frontExportRef = useRef<HTMLDivElement>(null);
  const backExportRef = useRef<HTMLDivElement>(null);
  const data = values[template];
  const templateLabel = useMemo(
    () => (template === 'english' ? 'English template' : '中文模板'),
    [template],
  );

  function update(field: keyof CardData, value: string) {
    setValues((current) => ({
      ...current,
      [template]: { ...current[template], [field]: value },
    }));
  }

  function recognize() {
    const lines = bulk
      .split(/\n|\r|\t/)
      .map((line) => line.trim())
      .filter(Boolean);
    const email = lines.find((line) => /\S+@\S+\.\S+/.test(line));
    const phone = lines.find((line) => /(?:\+?\d[\d\s()–—-]{6,}\d)/.test(line));
    const plain = lines.filter((line) => line !== email && line !== phone);
    setValues((current) => ({
      ...current,
      [template]: {
        name: plain[0] || current[template].name,
        title: plain[1] || current[template].title,
        phone: phone || current[template].phone,
        email: email || current[template].email,
      },
    }));
  }

  async function exportPdf() {
    if (
      !frontExportRef.current ||
      !backExportRef.current ||
      exportState === 'working'
    )
      return;

    setExportState('working');
    try {
      await document.fonts.ready;
      const options = {
        cacheBust: true,
        pixelRatio: 2.4,
        backgroundColor: '#ffffff',
      };
      const [front, back] = await Promise.all([
        toPng(frontExportRef.current, options),
        toPng(backExportRef.current, options),
      ]);
      const ratio = template === 'english' ? 1.62533 : 1.61733;
      const width = 90;
      const height = width / ratio;
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [height, width],
        compress: true,
      });
      pdf.addImage(front, 'PNG', 0, 0, width, height, undefined, 'FAST');
      pdf.addPage([height, width], 'landscape');
      pdf.addImage(back, 'PNG', 0, 0, width, height, undefined, 'FAST');
      const safeName = (data.name || 'Lightwheel')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-');
      pdf.save(`${safeName}-${template}-business-card.pdf`);
      setExportState('done');
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
              src="/lightwheel.svg"
              alt="Lightwheel"
              className="h-7 w-auto"
            />
            <span className="hidden h-5 w-px bg-[#dfe4ec] sm:block" />
            <span className="hidden text-sm font-medium text-[#697386] sm:block">
              Business Card Studio
            </span>
          </div>
          <span className="rounded-full bg-[#eef3ff] px-3 py-1.5 text-xs font-medium text-[#17428f]">
            Live preview
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-5 py-7 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-8">
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
              <NativeSelectOption value="english">
                英文模板 · PingFang
              </NativeSelectOption>
              <NativeSelectOption value="chinese">
                中文模板 · IBM Plex Sans SC
              </NativeSelectOption>
            </NativeSelect>
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

          <div className="mt-6 rounded-xl border border-[#dbe3f2] bg-[#f7f9fd] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#17428f]">
              <Sparkles className="size-4" />
              智能识别
            </div>
            <Textarea
              value={bulk}
              onChange={(event) => setBulk(event.target.value)}
              placeholder={'粘贴姓名、职位、电话和邮箱\n每项一行即可'}
              className="min-h-24 resize-none bg-white"
            />
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-9 w-full bg-white"
              onClick={recognize}
            >
              自动识别并填入
            </Button>
          </div>

          <Button
            type="button"
            className="mt-6 h-11 w-full bg-[#17428f] text-white"
            onClick={exportPdf}
            disabled={exportState === 'working'}
          >
            {exportState === 'working' ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : exportState === 'done' ? (
              <Check className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
            {exportState === 'working'
              ? '正在生成 PDF…'
              : exportState === 'done'
                ? 'PDF 已下载'
                : '下载双面 PDF'}
          </Button>
          {exportState === 'error' && (
            <p className="mt-2 text-center text-xs text-[#b4232f]">
              生成失败，请刷新页面后重试。
            </p>
          )}
        </section>

        <section className="preview-panel">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Preview</p>
              <h2 className="mt-1 text-xl font-semibold">{templateLabel}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#697386]">
              <FileText className="size-4" />
              正反面 · PDF
            </div>
          </div>
          <div className="preview-stage">
            <div className="preview-item">
              <span>正面</span>
              <BusinessCard template={template} side="front" data={data} />
            </div>
            <div className="preview-item">
              <span>背面</span>
              <BusinessCard template={template} side="back" data={data} />
            </div>
          </div>
        </section>
      </div>

      <div className="export-rack" aria-hidden="true">
        <BusinessCard
          template={template}
          side="front"
          data={data}
          cardRef={frontExportRef}
        />
        <BusinessCard
          template={template}
          side="back"
          data={data}
          cardRef={backExportRef}
        />
      </div>
    </main>
  );
}
