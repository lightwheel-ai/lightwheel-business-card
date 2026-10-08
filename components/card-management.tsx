'use client';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import { CardImport } from '@/components/card-import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Fields = { name: string; title: string; phone: string; email: string };
type Template = 'chinese' | 'english';
type RecordRow = Fields & {
  id: string;
  template: Template;
  version: number;
  source: string;
  updated_at: string;
  needs_review: boolean;
};
type RequestRow = {
  user_id: string;
  email: string;
  reason: string;
  status: string;
};
type HistoryRow = {
  id: number;
  action: string;
  created_at: string;
  snapshot: RecordRow;
};
export type ManagementHandle = {
  prepareDownload: () => (
    data: Fields,
    template: Template,
    kind: 'pdf' | 'png',
  ) => Promise<void>;
};

export const CardManagement = forwardRef<
  ManagementHandle,
  {
    template: Template;
    onUse: (data: Fields, template: Template) => void;
  }
>(function CardManagement({ template, onUse }, ref) {
  const [login, setLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [access, setAccess] = useState({ owner: false, manager: false });
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [screen, setScreen] = useState(false);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const selected = useRef<RecordRow | null>(null);
  const generation = useRef(0);
  const pendingSave = useRef(false);
  const identity = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [deleting, setDeleting] = useState<RecordRow | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [source, setSource] = useState<RecordRow | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceStatus, setSourceStatus] = useState('');
  useEffect(() => {
    let live = true;
    setSourceUrl('');
    if (!source || !access.manager) return;
    setSourceStatus('正在加载原图…');
    supabase.storage
      .from('card-sources')
      .createSignedUrl(`${source.id}/source.png`, 60)
      .then(({ data, error }) => {
        if (!live) return;
        setSourceUrl(data?.signedUrl ?? '');
        setSourceStatus(
          error ? '这条记录尚未保存原图，可以补传图片后核对。' : '',
        );
      });
    return () => {
      live = false;
    };
  }, [source, access.manager]);
  useEffect(() => {
    if (!access.manager) {
      setSource(null);
      setDeleting(null);
      setEditing(null);
      setUndo(null);
    }
  }, [access.manager]);

  async function refreshIdentity() {
    const epoch = ++generation.current;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (epoch !== generation.current) return;
    if (identity.current !== (session?.user.id ?? null)) {
      identity.current = session?.user.id ?? null;
      setAccess({ owner: false, manager: false });
      setRecords([]);
      setRequests([]);
      setHistory([]);
      setEditing(null);
      setSource(null);
      setDeleting(null);
      setUndo(null);
      selected.current = null;
      setPage(0);
    }
    setUser(session?.user.email ?? null);
    if (!session) {
      setAccess({ owner: false, manager: false });
      setRecords([]);
      setRequests([]);
      setHistory([]);
      selected.current = null;
      return;
    }
    const { data, error } = await supabase.rpc('card_access');
    if (epoch !== generation.current) return;
    setAccess(
      error
        ? { owner: false, manager: false }
        : { owner: data?.owner === true, manager: data?.manager === true },
    );
    if (error || !data?.manager) {
      setRecords([]);
      setHistory([]);
      selected.current = null;
    }
    if (error) setMessage('无法读取管理权限，请稍后重试。');
    const result = await supabase
      .from('card_admin_requests')
      .select('user_id,email,reason,status')
      .order('requested_at', { ascending: false });
    if (epoch === generation.current) setRequests(result.data ?? []);
  }
  useEffect(() => {
    void refreshIdentity();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void refreshIdentity(), 0);
    });
    const focus = () => void refreshIdentity();
    const route = () => setScreen(window.location.hash === '#records');
    route();
    window.addEventListener('focus', focus);
    window.addEventListener('hashchange', route);
    return () => {
      generation.current++;
      subscription.unsubscribe();
      window.removeEventListener('focus', focus);
      window.removeEventListener('hashchange', route);
    };
  }, []);
  useEffect(() => {
    let live = true;
    if (!access.manager || !screen) return;
    setLoading(true);
    supabase
      .from('card_records')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(page * 100, page * 100 + 99)
      .then(({ data, error }) => {
        if (!live) return;
        setLoading(false);
        if (error) {
          setRecords([]);
          setMessage('记录加载失败，请重新登录或重试。');
        } else setRecords(data ?? []);
      });
    return () => {
      live = false;
    };
  }, [access.manager, screen, page, revision]);

  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败，请重试。');
    } finally {
      setBusy(false);
    }
  }
  async function save(
    fields: Fields,
    chosenTemplate: Template,
    event: string,
    row = selected.current,
    actor = identity.current,
  ) {
    if (pendingSave.current)
      throw new Error('上一条记录仍在保存，请稍后重试。');
    pendingSave.current = true;
    try {
      if (!actor || actor !== identity.current)
        throw new Error('登录账号已变化，请重新保存。');
      const { data: role, error: roleError } =
        await supabase.rpc('card_access');
      if (roleError || !role?.manager)
        throw new Error('管理权限不可用，请重新登录后重试。');
      const { data, error } = await supabase.rpc('card_save', {
        fields: { ...fields, template: chosenTemplate, needs_review: false },
        event_action: event,
        record_id: row?.id ?? null,
        expected_version: row?.version ?? null,
      });
      if (error)
        throw new Error(
          error.code === '40001'
            ? '记录已被其他成员修改，请重新载入后再保存。'
            : '保存失败，请保留当前内容并稍后重试。',
        );
      if (actor === identity.current && selected.current === row)
        selected.current = data as RecordRow;
      setRevision((n) => n + 1);
      return data as RecordRow;
    } finally {
      pendingSave.current = false;
    }
  }
  useImperativeHandle(ref, () => ({
    prepareDownload() {
      const row = selected.current;
      const actor = identity.current;
      const allowed = !!user && access.manager;
      return async (fields, chosenTemplate, kind) => {
        // Guests never persist card details. Database still authorizes every manager write.
        if (!allowed) return;
        if (pendingSave.current) {
          setMessage(
            '文件已下载，但另一条记录仍在保存，请稍后重新下载以保存记录。',
          );
          return;
        }
        try {
          await save(fields, chosenTemplate, kind, row, actor);
          setMessage('下载记录已保存。');
        } catch (e) {
          setMessage(
            `文件已下载，历史记录未保存：${e instanceof Error ? e.message : '请重试'}`,
          );
        }
      };
    },
  }));
  function loadRecord(row: RecordRow) {
    selected.current = row;
    onUse(row, row.template);
    window.location.hash = '';
    setHistory([]);
    setMessage('已载入记录，可修改后重新下载。');
  }
  async function loadHistory(row: RecordRow) {
    const { data, error } = await supabase
      .from('card_events')
      .select('id,action,created_at,snapshot')
      .eq('record_id', row.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error('历史记录读取失败。');
    setHistory(data ?? []);
  }
  return (
    <>
      <div className="flex items-center gap-2">
        {access.manager && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                window.location.hash = '#records';
                setMessage('');
              }}
            >
              名片记录
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => setLogin(true)}>
          {user
            ? access.owner
              ? '主管理者'
              : access.manager
                ? '管理者'
                : '申请管理权限'
            : '管理者登录'}
        </Button>
      </div>
      {message && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-40 max-w-md rounded-xl border bg-white p-4 text-sm shadow-lg"
        >
          {message}
          {undo && (
            <button
              className="ml-3 underline"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const { error } = await supabase.rpc('card_restore', {
                    record_id: undo,
                  });
                  if (error) throw new Error('恢复失败，请重试。');
                  setUndo(null);
                  setRevision((n) => n + 1);
                  setMessage('记录已恢复。');
                })
              }
            >
              撤销删除
            </button>
          )}
          <button className="ml-4 underline" onClick={() => setMessage('')}>
            关闭
          </button>
        </div>
      )}
      <Dialog open={login} onOpenChange={setLogin}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{user ? '管理者账号' : '管理者登录'}</DialogTitle>
          <DialogDescription>
            普通用户无需登录。设计团队验证邮箱并获批后，可使用名片记录等管理功能。
          </DialogDescription>
          {!user ? (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  if (!sent) {
                    const { error } = await supabase.auth.signInWithOtp({
                      email: email.trim(),
                      options: { shouldCreateUser: true },
                    });
                    if (error)
                      throw new Error(
                        '验证码发送失败，请检查邮箱，或稍后重试。',
                      );
                    setSent(true);
                    setMessage('验证码已发送，请检查收件箱或垃圾邮件。');
                  } else {
                    const { error } = await supabase.auth.verifyOtp({
                      email: email.trim(),
                      token: code.trim(),
                      type: 'email',
                    });
                    if (error) throw new Error('验证码无效或已过期，请重试。');
                    await refreshIdentity();
                    setCode('');
                    setSent(false);
                  }
                });
              }}
            >
              <label htmlFor="manager-email">
                邮箱
                <Input
                  id="manager-email"
                  type="email"
                  required
                  value={email}
                  readOnly={sent}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              {sent && (
                <label htmlFor="manager-code">
                  邮箱验证码
                  <Input
                    id="manager-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? '处理中…' : sent ? '验证并登录' : '发送验证码'}
              </Button>
              {sent && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setSent(false);
                    setCode('');
                  }}
                >
                  更换邮箱或重新发送
                </Button>
              )}
            </form>
          ) : (
            <div className="grid gap-3">
              <p className="break-all">{user}</p>
              {access.manager ? (
                <p>
                  {access.owner
                    ? '你可以审批申请、撤销权限并管理团队名片。'
                    : '你已获批，可管理团队名片记录。'}
                </p>
              ) : (
                <>
                  <p>
                    申请状态：
                    {(
                      {
                        pending: '待审批',
                        rejected: '已拒绝',
                        revoked: '已撤销',
                      } as Record<string, string>
                    )[requests[0]?.status] ?? '未申请'}
                  </p>
                  <Textarea
                    aria-label="申请说明"
                    placeholder="请填写姓名、团队和申请原因"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                  />
                  <Button
                    disabled={
                      busy ||
                      !reason.trim() ||
                      ['pending', 'revoked'].includes(requests[0]?.status)
                    }
                    onClick={() =>
                      void action(async () => {
                        const { error } = await supabase.rpc(
                          'card_request_access',
                          { request_reason: reason.trim() },
                        );
                        if (error) throw new Error('申请提交失败。');
                        await refreshIdentity();
                        setMessage('申请已提交，等待主管理者审批。');
                      })
                    }
                  >
                    提交申请
                  </Button>
                </>
              )}
              {access.owner && (
                <Button
                  onClick={() => {
                    setLogin(false);
                    window.location.hash = '#records';
                  }}
                >
                  进入记录与审批
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const { error } = await supabase.auth.signOut();
                    if (error) throw new Error('退出失败，请重试。');
                    await refreshIdentity();
                    setLogin(false);
                    window.location.hash = '';
                  })
                }
              >
                退出登录
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <section
        hidden={!screen}
        className="fixed inset-0 z-30 overflow-auto bg-[#f3f5f8] p-5 pb-52 sm:p-8 sm:pb-52"
      >
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">团队名片记录</h1>
            <Button
              variant="outline"
              onClick={() => {
                window.location.hash = '';
              }}
            >
              返回制作页
            </Button>
          </div>
          {!access.manager ? (
            <div className="rounded-xl bg-white p-6">
              <p>请登录并获得管理权限后查看。</p>
              <Button className="mt-4" onClick={() => setLogin(true)}>
                管理者登录
              </Button>
            </div>
          ) : (
            <>
              <CardImport
                template={template}
                onSaved={() => setRevision((n) => n + 1)}
                visible={true}
              />
              <div className="rounded-xl border bg-white p-4">
                {loading ? (
                  <output>正在加载…</output>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          '姓名',
                          '职位',
                          '电话',
                          '邮箱',
                          '来源 / 核对',
                          '模板',
                          '更新时间',
                          '操作',
                        ].map((x) => (
                          <TableHead key={x}>{x}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <button
                              className="font-medium text-blue-700 underline"
                              onClick={() => loadRecord(row)}
                            >
                              {row.name || '未填写姓名'}
                            </button>
                          </TableCell>
                          <TableCell>{row.title}</TableCell>
                          <TableCell>{row.phone}</TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>
                            <button
                              className="block max-w-48 break-all text-left text-blue-700 underline"
                              onClick={() => setSource(row)}
                            >
                              {row.source === 'manual'
                                ? '手动制作'
                                : row.source}
                            </button>
                            <span
                              className={
                                row.needs_review
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                              }
                            >
                              {row.needs_review ? '待核对' : '已核对'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.template === 'chinese' ? '中文' : '英文'}
                          </TableCell>
                          <TableCell>
                            {new Date(row.updated_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setEditing({ ...row })}
                            >
                              编辑核对
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void action(() => loadHistory(row))
                              }
                            >
                              历史版本
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-red-700"
                              disabled={busy}
                              onClick={() => setDeleting(row)}
                            >
                              删除记录
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {!loading && !records.length && (
                  <p className="py-8 text-center text-slate-500">
                    还没有名片记录。导入或下载一张名片即可建立记录。
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={page === 0 || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    上一页
                  </Button>
                  <span>第 {page + 1} 页</span>
                  <Button
                    variant="outline"
                    disabled={records.length < 100 || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
              {history.length > 0 && (
                <div className="rounded-xl border bg-white p-4">
                  <h2 className="mb-3 text-lg font-semibold">
                    历史版本（最近 100 条）
                  </h2>
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b py-3"
                    >
                      <span>
                        {new Date(item.created_at).toLocaleString()} ·{' '}
                        {item.action} · {item.snapshot.name} /{' '}
                        {item.snapshot.title}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => {
                          selected.current = null;
                          onUse(item.snapshot, item.snapshot.template);
                          window.location.hash = '';
                          setHistory([]);
                          setMessage('已从历史版本载入，保存时将建立新记录。');
                        }}
                      >
                        使用此版本制作
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {access.owner && (
                <div className="rounded-xl border bg-white p-4">
                  <h2 className="mb-3 text-lg font-semibold">
                    管理者申请与权限
                  </h2>
                  {!requests.length && <p>暂无申请。</p>}
                  {requests.map((r) => (
                    <div
                      key={r.user_id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b py-4"
                    >
                      <div>
                        <p>
                          {r.email} · {r.status}
                        </p>
                        <p className="text-sm text-slate-500">{r.reason}</p>
                      </div>
                      <div className="flex gap-2">
                        {(r.status === 'approved'
                          ? ['revoked']
                          : ['approved', 'rejected']
                        ).map((decision) => (
                          <Button
                            key={decision}
                            variant="outline"
                            disabled={busy || r.status === decision}
                            onClick={() =>
                              void action(async () => {
                                const { error } = await supabase.rpc(
                                  'card_review_access',
                                  { target_user: r.user_id, decision },
                                );
                                if (error)
                                  throw new Error('审批失败，请重试。');
                                await refreshIdentity();
                              })
                            }
                          >
                            {
                              (
                                {
                                  approved: '批准',
                                  rejected: '拒绝',
                                  revoked: '撤销权限',
                                } as Record<string, string>
                              )[decision]
                            }
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>删除这条名片记录？</DialogTitle>
          <DialogDescription>
            {deleting?.name || '未填写姓名'}
            ：删除后将从团队记录中移除，可通过提示中的“撤销删除”恢复。
          </DialogDescription>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  if (!deleting) return;
                  const { error } = await supabase.rpc('card_delete', {
                    record_id: deleting.id,
                    expected_version: deleting.version,
                  });
                  if (error)
                    throw new Error(
                      error.code === '40001'
                        ? '记录已变化，请刷新后重试。'
                        : '删除失败，请重试。',
                    );
                  if (selected.current?.id === deleting.id)
                    selected.current = null;
                  setUndo(deleting.id);
                  setDeleting(null);
                  setHistory([]);
                  setRevision((n) => n + 1);
                  setMessage('记录已移除。');
                })
              }
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!source}
        onOpenChange={(open) => {
          if (!open) setSource(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-auto">
          <DialogTitle>来源图片预览</DialogTitle>
          <DialogDescription>
            {source?.source === 'manual'
              ? '手动制作的名片没有导入原图。'
              : source?.source}
          </DialogDescription>
          {sourceStatus && <p role="status">{sourceStatus}</p>}
          {sourceUrl && (
            <img
              src={sourceUrl}
              alt="导入名片原图"
              className="max-h-[65vh] w-full object-contain"
              onError={() => {
                setSourceUrl('');
                setSourceStatus('原图加载失败，请关闭后重新打开。');
              }}
            />
          )}
          {!sourceUrl && source && (
            <label className="inline-flex w-fit cursor-pointer rounded-md border bg-white px-4 py-2">
              补传原图
              <input
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp,image/bmp"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  const row = source;
                  void action(async () => {
                    if (file.size > 20 * 1024 * 1024)
                      throw new Error('图片不能超过 20 MB。');
                    const bitmap = await createImageBitmap(file);
                    const canvas = document.createElement('canvas');
                    const scale = Math.min(
                      1,
                      3000 / Math.max(bitmap.width, bitmap.height),
                    );
                    canvas.width = Math.ceil(bitmap.width * scale);
                    canvas.height = Math.ceil(bitmap.height * scale);
                    const ctx = canvas.getContext('2d')!;
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                    bitmap.close();
                    const blob = await new Promise<Blob | null>((resolve) =>
                      canvas.toBlob(resolve, 'image/png'),
                    );
                    canvas.width = 0;
                    canvas.height = 0;
                    if (!blob) throw new Error('图片读取失败。');
                    const { error } = await supabase.storage
                      .from('card-sources')
                      .upload(`${row.id}/source.png`, blob, {
                        contentType: 'image/png',
                        upsert: false,
                      });
                    if (error)
                      throw new Error(
                        '上传失败，可能已有原图或权限已变化，请重新打开预览。',
                      );
                    setSource((current) =>
                      current?.id === row.id ? { ...row } : current,
                    );
                    setMessage('原图已保存，仅管理者可查看。');
                  });
                }}
              />
            </label>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle>编辑并核对名片</DialogTitle>
          <DialogDescription>
            确认识别内容无误后保存，历史版本会保留。
          </DialogDescription>
          {editing && (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  const { data, error } = await supabase.rpc('card_save', {
                    fields: {
                      name: editing.name,
                      title: editing.title,
                      phone: editing.phone,
                      email: editing.email,
                      template: editing.template,
                      needs_review: false,
                    },
                    record_id: editing.id,
                    expected_version: editing.version,
                    event_action: 'edit',
                  });
                  if (error)
                    throw new Error(
                      error.code === '40001'
                        ? '该条记录已被修改，请关闭后刷新记录再编辑。'
                        : '保存失败，请检查权限后重试。',
                    );
                  if (selected.current?.id === editing.id)
                    selected.current = data as RecordRow;
                  setEditing(null);
                  setRevision((n) => n + 1);
                  setMessage('已保存并标记为已核对。');
                });
              }}
            >
              {(['name', 'title', 'phone', 'email'] as const).map((key) => (
                <label key={key} htmlFor={`edit-${key}`}>
                  {
                    {
                      name: '姓名',
                      title: '职位',
                      phone: '电话',
                      email: '邮箱',
                    }[key]
                  }
                  <Input
                    id={`edit-${key}`}
                    value={editing[key]}
                    maxLength={
                      { name: 160, title: 240, phone: 100, email: 254 }[key]
                    }
                    onChange={(e) =>
                      setEditing({ ...editing, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <Button type="submit" disabled={busy}>
                保存并标记已核对
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});
