'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';

type Job = { name: string; status: string; saved: number; error?: string };
export function CardImport({
  template,
  onSaved,
  visible,
}: {
  template: 'chinese' | 'english';
  onSaved: () => void;
  visible: boolean;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [detail, setDetail] = useState('');
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function start(files: File[]) {
    if (controller.current || !files.length) return;
    if (files.length > 30) {
      setNotice('每批最多 30 个文件，请分批导入。');
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setNotice('');
    setJobs(
      files.map((file) => ({ name: file.name, status: '等待中', saved: 0 })),
    );
    let importer:
      | ReturnType<typeof import('@/lib/card-import').createCardImporter>
      | undefined;
    const update = (i: number, patch: Partial<Job>) =>
      setJobs((prev) =>
        prev.map((row, index) => (index === i ? { ...row, ...patch } : row)),
      );
    try {
      const module = await import('@/lib/card-import');
      importer = module.createCardImporter(abort.signal, setDetail);
      for (const [i, file] of files.entries()) {
        if (abort.signal.aborted) break;
        update(i, { status: '处理中' });
        let saved = 0;
        try {
          for await (const fields of importer.read(file)) {
            if (abort.signal.aborted) break;
            if (
              fields.name.length > 160 ||
              fields.title.length > 240 ||
              fields.phone.length > 100 ||
              fields.email.length > 254
            )
              throw new Error('识别出的字段过长，请检查名片排版或表格内容。');
            const { preview, ...values } = fields;
            const { data: record, error } = await supabase.rpc('card_save', {
              fields: {
                ...values,
                source: fields.source.slice(0, 500),
                template,
                needs_review: true,
              },
              event_action: 'import',
            });
            if (error)
              throw new Error(
                error.code === '42501'
                  ? '管理权限不可用，导入已停止。'
                  : '云端保存失败；已成功保存的条目仍保留，请核对后再重试。',
              );
            saved++;
            update(i, { saved });
            if (preview) {
              const { error: uploadError } = await supabase.storage
                .from('card-sources')
                .upload(`${record.id}/source.png`, preview, {
                  contentType: 'image/png',
                  upsert: false,
                });
              if (uploadError)
                throw new Error(
                  '识别结果已保存，但原图上传失败，请勿重复导入；可在来源预览中补传原图。',
                );
            }
          }
          update(i, {
            status: abort.signal.aborted
              ? '已停止'
              : saved
                ? '已完成'
                : '无有效记录',
          });
        } catch (e) {
          update(i, {
            status: abort.signal.aborted ? '已停止' : '失败',
            error: e instanceof Error ? e.message : '读取失败',
          });
        } finally {
          if (saved) onSaved();
        }
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '导入组件加载失败，请重试。');
    } finally {
      await importer?.close().catch(() => {});
      controller.current = null;
      setRunning(false);
      setDetail('');
      setJobs((prev) =>
        prev.map((job) =>
          job.status === '等待中' ? { ...job, status: '未处理' } : job,
        ),
      );
    }
  }
  const done = jobs.filter(
    (job) => !['等待中', '处理中'].includes(job.status),
  ).length;
  return (
    <>
      <div
        hidden={!visible}
        className="space-y-3 rounded-xl border bg-white p-4"
      >
        <Button disabled={running} onClick={() => input.current?.click()}>
          {running ? '正在导入…' : '导入名片'}
        </Button>
        <input
          ref={input}
          type="file"
          aria-label="选择名片图片、PDF 或表格"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.bmp,.pdf,.xlsx,.csv,.tsv"
          className="hidden"
          disabled={running}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void start(files);
          }}
        />
        {notice && (
          <p role="alert" className="text-sm text-red-700">
            {notice}
          </p>
        )}
        {!!jobs.length && (
          <div className="max-h-56 overflow-auto text-sm">
            {jobs.map((job, index) => (
              <div key={index} className="border-t py-2">
                <p className="break-all">
                  {job.name} · {job.status} · 已保存 {job.saved} 条
                </p>
                {job.error && <p className="text-red-700">{job.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      {!!jobs.length &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border bg-white p-4 shadow-lg">
            <button
              className="w-full text-left"
              onClick={() => {
                window.location.hash = '#records';
              }}
            >
              <strong className="block">
                {running ? '正在导入名片' : '导入结果'} · {done}/{jobs.length}
              </strong>
              <span className="text-sm text-slate-600">
                已保存 {jobs.reduce((n, job) => n + job.saved, 0)} 条 ·
                点击查看记录
              </span>
            </button>
            <Progress
              value={jobs.length ? (done / jobs.length) * 100 : 0}
              aria-label="文件导入进度"
            />
            {detail && <p className="text-sm">{detail}</p>}
            {running ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => controller.current?.abort()}
              >
                停止后续导入
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setJobs([])}>
                收起进度
              </Button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
