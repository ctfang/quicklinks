import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Empty, Input, Modal, Select, Switch, Typography } from 'antd';
import { ArrowDown, ArrowUp, Edit2, Plus, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { FloatingLink, normalizeFloatingUrl, useFloatingNavigation } from '../lib/floatingNavigation';
import { NavIcon } from './LinkGrid';

const iconOptions = ['Link', 'Globe', 'Sparkles', 'Brain', 'Sparkle', 'Waves', 'Github', 'BookOpen', 'MessageSquareCode', 'Bot', 'Code', 'Terminal'];

export function FloatingNavigationSettings() {
  const { user } = useAppContext();
  const [value, save, storageError, busy] = useFloatingNavigation(user?.id ?? null);
  const [editor, setEditor] = useState<FloatingLink | null>(null);
  const [error, setError] = useState('');
  const updateDraft = (change: Partial<FloatingLink>) => setEditor(current => current ? { ...current, ...change } : null);
  const edit = (link?: FloatingLink) => {
    setError('');
    setEditor(link ? { ...link } : { id: crypto.randomUUID(), title: '', url: '', icon: 'Link' });
  };
  const move = (index: number, delta: number) => {
    const links = [...value.left];
    [links[index], links[index + delta]] = [links[index + delta], links[index]];
    save({ ...value, left: links });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    try {
      if (!editor.title.trim()) throw new Error('请填写导航名称');
      if (!editor.url.trim()) throw new Error('请填写网站地址');
      const link = { ...editor, title: editor.title.trim(), url: normalizeFloatingUrl(editor.url) };
      const exists = value.left.some(item => item.id === link.id);
      if (await save({ ...value, left: exists ? value.left.map(item => item.id === link.id ? link : item) : [...value.left, link] })) setEditor(null);
    } catch (err) { setError(err instanceof Error ? err.message : '请输入有效的网站地址'); }
  };

  return <div className="space-y-6">
    <Typography.Paragraph type="secondary">左侧快捷导航保存到当前账号，可跨浏览器和设备同步，个人与团队空间共用。右侧自动显示最近点击的 8 个网站，按网址去重，记录仅保存在当前浏览器。</Typography.Paragraph>
    {storageError && <Alert type="warning" title={storageError} showIcon />}
    <Card title="左侧导航" extra={<Switch disabled={busy} aria-label="显示左侧导航" checked={value.leftEnabled} onChange={checked => save({ ...value, leftEnabled: checked })} />}>
      <fieldset disabled={busy} className="space-y-3">
        {value.left.length === 0 && <Empty description="暂无导航链接" />}
        {value.left.map((link, index) => <div key={link.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className="flex items-center justify-center w-9 h-9 text-blue-600"><NavIcon name={link.icon} url={link.url} pixelSize={22} strokeWidth={1.7} /></span>
          <div className="min-w-0 flex-1"><div className="truncate font-medium">{link.title}</div><Typography.Text type="secondary" className="block truncate text-xs">{link.url}</Typography.Text></div>
          <div className="flex gap-1">
            <Button size="small" aria-label={`上移${link.title}`} disabled={index === 0} onClick={() => move(index, -1)} icon={<ArrowUp size={14} />} />
            <Button size="small" aria-label={`下移${link.title}`} disabled={index === value.left.length - 1} onClick={() => move(index, 1)} icon={<ArrowDown size={14} />} />
            <Button size="small" aria-label={`编辑${link.title}`} onClick={() => edit(link)} icon={<Edit2 size={14} />} />
            <Button size="small" danger aria-label={`删除${link.title}`} onClick={() => save({ ...value, left: value.left.filter(item => item.id !== link.id) })} icon={<Trash2 size={14} />} />
          </div>
        </div>)}
        <Button block type="dashed" onClick={() => edit()} icon={<Plus size={16} />}>添加左侧导航链接</Button>
      </fieldset>
    </Card>
    <Modal title="左侧导航链接" open={Boolean(editor)} onCancel={() => setEditor(null)} footer={null} centered destroyOnHidden>
      {editor && <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="floating-title" className="block mb-2">导航名称</label><Input id="floating-title" required autoFocus value={editor.title} onChange={e => updateDraft({ title: e.target.value })} placeholder="例如：GitHub" /></div>
        <div><label htmlFor="floating-url" className="block mb-2">网站地址</label><Input id="floating-url" required value={editor.url} onChange={e => updateDraft({ url: e.target.value })} placeholder="https://github.com" /></div>
        <div><label htmlFor="floating-icon" className="block mb-2">图标</label><Select id="floating-icon" className="w-full" value={editor.icon} onChange={icon => updateDraft({ icon })} options={[...new Set([...iconOptions, editor.icon])].map(icon => ({ value: icon, label: icon }))} /></div>
        {(error || storageError) && <Alert type="error" title={error || storageError} showIcon />}
        <div className="flex justify-end gap-3"><Button onClick={() => setEditor(null)}>取消</Button><Button type="primary" htmlType="submit" disabled={busy}>保存</Button></div>
      </form>}
    </Modal>
  </div>;
}
