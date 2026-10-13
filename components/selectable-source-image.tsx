'use client';
/* oxlint-disable next/no-img-element -- text coordinates align to the unmodified source image */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ImageText } from '@/lib/source-image-text';

// Keep a few text layers in memory; never persist private source images here.
const textCache = new Map<string, ImageText>();

export function SelectableSourceImage({
  src,
  template,
  onError,
}: {
  src: string;
  template: 'chinese' | 'english';
  onError: () => void;
}) {
  const key = new URL(src).origin + new URL(src).pathname + ':' + template;
  const [result, setResult] = useState<ImageText | undefined>(() =>
    textCache.get(key),
  );
  const [status, setStatus] = useState(() =>
    textCache.has(key) ? '' : '启用后可拖选图片文字并复制',
  );
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    // Signed URL tokens change on reopening; the source object remains the same.
    const cached = textCache.get(key);
    if (cached || !requested) {
      return () => controller.abort();
    }
    void import('@/lib/source-image-text')
      .then(({ recognizeSourceImage }) => {
        controller.signal.throwIfAborted();
        return recognizeSourceImage(
          src,
          template,
          controller.signal,
          setStatus,
        );
      })
      .then((recognized) => {
        if (controller.signal.aborted) return;
        if (!recognized.lines.length) {
          setStatus('未识别到可复制文字');
          setFailed(true);
          return;
        }
        if (textCache.size >= 5)
          textCache.delete(textCache.keys().next().value!);
        textCache.set(key, recognized);
        setResult(recognized);
        setStatus('');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus('文字识别失败，可重试');
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [src, template, key, retry, requested]);

  async function copyAll() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      setStatus('请拖选文字，按 ⌘C / Ctrl+C 复制');
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <output>{status || '拖选图片文字，按 ⌘C / Ctrl+C 复制'}</output>
        {!result ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={requested && !failed}
            onClick={() => {
              setFailed(false);
              setRequested(true);
              setStatus('正在准备可复制文字…');
              setRetry((n) => n + 1);
            }}
          >
            {failed ? '重试识别' : requested ? '正在识别…' : '启用文字复制'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!result}
            onClick={() => void copyAll()}
          >
            {copied ? '已复制' : '复制全部文字'}
          </Button>
        )}
      </div>
      <div
        className="relative mx-auto w-fit max-w-full bg-white shadow-md"
        style={
          result
            ? {
                width: `min(100%, calc(65svh * ${result.width / result.height}))`,
                containerType: 'inline-size',
              }
            : undefined
        }
      >
        <img
          src={src}
          alt="核对用名片原图"
          draggable={false}
          className="block max-h-[65svh] max-w-full object-contain"
          style={{ width: result ? '100%' : undefined, userSelect: 'none' }}
          onError={onError}
        />
        {result && (
          <div
            className="source-text-layer absolute inset-0 h-full w-full"
            aria-label="原图可复制文字"
          >
            {result.lines.map((line, index) => (
              <span
                key={index}
                className="source-text-line"
                style={{
                  left: `${(line.x / result.width) * 100}%`,
                  top: `${(line.y / result.height) * 100}%`,
                  fontSize: `${(line.height / result.width) * 100}cqw`,
                  transform: `scaleX(${line.stretch})`,
                }}
              >
                {line.text}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
