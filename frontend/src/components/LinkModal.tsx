import { Input, Button, Select, Segmented, Modal, Typography } from 'antd';
import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Type, Image, Palette } from 'lucide-react';
import * as Icons from 'lucide-react';
import { NavLink, NavGroup } from '../services/api';
import { navigationCardSize } from '../lib/navigationCard';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: Partial<NavLink>) => Promise<void>;
  initialData?: NavLink | null;
  initialDisplaySize?: NavLink['displaySize'];
  groups?: NavGroup[];
  initialGroupId?: string;
}

export const LinkModal = ({ isOpen, onClose, onSave, initialData, initialDisplaySize, initialGroupId, groups = [] }: LinkModalProps) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');
  const [displaySize, setDisplaySize] = useState<NavLink['displaySize']>('icon');
  const [displaySizeChanged, setDisplaySizeChanged] = useState(false);
  const [groupId, setGroupId] = useState<string>('');
  const [bgColor, setBgColor] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [iconMode, setIconMode] = useState<'preset' | 'url'>('preset');

  // 常用 Lucide 图标选项
  const iconOptions = [
    { name: 'Link', label: '链接' },
    { name: 'Globe', label: '地球' },
    { name: 'Home', label: '首页' },
    { name: 'Mail', label: '邮件' },
    { name: 'Github', label: 'GitHub' },
    { name: 'Twitter', label: 'Twitter' },
    { name: 'Facebook', label: 'Facebook' },
    { name: 'Instagram', label: 'Instagram' },
    { name: 'Youtube', label: 'YouTube' },
    { name: 'Music', label: '音乐' },
    { name: 'Video', label: '视频' },
    { name: 'Image', label: '图片' },
    { name: 'FileText', label: '文档' },
    { name: 'ShoppingCart', label: '购物' },
    { name: 'CreditCard', label: '支付' },
    { name: 'MapPin', label: '地图' },
    { name: 'Calendar', label: '日历' },
    { name: 'Clock', label: '时钟' },
    { name: 'Star', label: '收藏' },
    { name: 'Heart', label: '喜欢' },
    { name: 'Bookmark', label: '书签' },
    { name: 'Search', label: '搜索' },
    { name: 'Settings', label: '设置' },
    { name: 'User', label: '用户' },
    { name: 'Users', label: '团队' },
    { name: 'Briefcase', label: '工作' },
    { name: 'BookOpen', label: '阅读' },
    { name: 'Code', label: '代码' },
    { name: 'Terminal', label: '终端' },
    { name: 'Database', label: '数据库' },
    { name: 'Cloud', label: '云' },
    { name: 'Wifi', label: '网络' },
    { name: 'Smartphone', label: '手机' },
    { name: 'Monitor', label: '电脑' },
    { name: 'Gamepad2', label: '游戏' },
    { name: 'Newspaper', label: '新闻' },
  ];

  // 预设颜色选项
  const colorOptions = [
    { value: '', label: '默认' },
    { value: '#3b82f6', label: '蓝色' },
    { value: '#10b981', label: '绿色' },
    { value: '#f59e0b', label: '橙色' },
    { value: '#ef4444', label: '红色' },
    { value: '#8b5cf6', label: '紫色' },
    { value: '#ec4899', label: '粉色' },
    { value: '#06b6d4', label: '青色' },
    { value: '#6366f1', label: '靛蓝' },
    { value: '#14b8a6', label: ' teal' },
    { value: '#f97316', label: '橙红' },
    { value: '#84cc16', label: '青柠' },
  ];

  useEffect(() => {
    setDisplaySizeChanged(false);
    if (initialData) {
      setTitle(initialData.title);
      setUrl(initialData.url);
      setIcon(initialData.icon || '');
      setDisplaySize(navigationCardSize(initialDisplaySize ?? initialData.displaySize, 0, 'configured'));
      setGroupId(initialData.groupId || '');
      setBgColor(initialData.bgColor || '');
      // 判断当前图标是预设图标还是URL
      const trimmedIcon = (initialData.icon || '').trim();
      setIconMode(/^https?:\/\//i.test(trimmedIcon) || trimmedIcon.startsWith('/static/icons/') ? 'url' : 'preset');
    } else {
      setTitle('');
      setUrl('');
      setIcon('');
      setDisplaySize('icon');
      setGroupId(initialGroupId || '');
      setBgColor('');
      setIconMode('preset');
    }
  }, [initialData, initialDisplaySize, initialGroupId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const u = url.trim();
    if (!u) return;
    setIsLoading(true);
    try {
      const payload: Partial<NavLink> = {
        url: u,
        groupId: groupId || undefined,
        // 显式发送 null 来清除背景色，undefined 会被 JSON.stringify 忽略
        bgColor: bgColor || null,
      };
      if (!initialData || displaySizeChanged) payload.displaySize = displaySize;
      const t = title.trim();
      if (t) payload.title = t;
      const ic = icon.trim();
      payload.icon = ic;
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal destroyOnHidden open={isOpen} title={initialData ? '编辑导航' : '添加导航'} centered width={480} footer={null} zIndex={1000}
      onCancel={() => { if (!isLoading) onClose(); }} mask={{ closable: !isLoading }} keyboard={!isLoading} closable={!isLoading}
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } }}>
      <Typography.Paragraph type="secondary">{initialData ? '修改链接信息' : '只需填写地址；标题与图标可由服务器自动抓取'}</Typography.Paragraph>
      <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input prefix={<LinkIcon size={18} />}
                type="text"
                placeholder="网站地址（必填，可省略 https://）"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full"
              aria-label="网站地址（必填，可省略 https://）" />
            </div>

            <div className="relative">
              <Input prefix={<Type size={18} />}
                type="text"
                placeholder="网站名称（可选，留空则自动抓取）"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full"
              aria-label="网站名称（可选，留空则自动抓取）" />
            </div>

            {/* 图标选择 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--ui-text-secondary)] text-sm">
                  <Image size={16} />
                  <span>图标</span>
                </div>
                <Segmented<'preset' | 'url'> value={iconMode} onChange={setIconMode} options={[{ value: 'preset', label: '预设图标' }, { value: 'url', label: '图片 URL' }]} />
              </div>

              {iconMode === 'preset' ? (
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1 max-h-32 overflow-y-auto p-1">
                  <Button type={icon === '' ? 'primary' : 'default'} size="small" aria-pressed={icon === ''}
                    htmlType="button"
                    onClick={() => setIcon('')}

                    title="自动获取"
                  >
                    <span className="text-xs">自动</span>
                  </Button>
                  {iconOptions.map((option) => {
                    const IconsRecord = Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>;
                    const IconComponent = IconsRecord[option.name];
                    if (!IconComponent) return null;
                    return (
                      <Button type={icon === option.name ? 'primary' : 'default'} size="small" aria-pressed={icon === option.name} aria-label={option.label}
                        key={option.name}
                        htmlType="button"
                        onClick={() => setIcon(option.name)}

                        title={option.label}
                      >
                        <IconComponent size={18} />
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="relative">
                  <Input prefix={<Image size={18} />}
                    type="text"
                    placeholder="输入图标图片 URL（如: https://example.com/icon.png）"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full"
                  aria-label="输入图标图片 URL（如: https://example.com/icon.png）" />
                </div>
              )}
            </div>

            {groups.length > 0 && (
              <div className="relative">
                <Select aria-label="所属分组" className="w-full" value={groupId} onChange={setGroupId} options={[{ value: '', label: '未分组' }, ...groups.map(g => ({ value: g.id, label: g.name }))]} />
              </div>
            )}

            <div className="relative">
              <Select aria-label="卡片尺寸" className="w-full" value={displaySize} onChange={value => { setDisplaySize(value); setDisplaySizeChanged(true); }} options={[
                { value: 'icon', label: '极简图标 (最小)' }, { value: 'small', label: '小尺寸 (紧凑列表)' },
                { value: 'medium', label: '中尺寸 (标准卡片)' }, { value: 'large', label: '大尺寸 (宽幅卡片)' }, { value: 'list', label: '列表 (横向拉伸)' },
              ]} />
              <p className="text-xs text-slate-500 mt-2">选择文字卡片尺寸并保存后，当前空间自动切换为“按链接设置”布局。</p>
            </div>

            {/* 背景颜色选择 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[var(--ui-text-secondary)] text-sm">
                <Palette size={16} />
                <span>背景颜色</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <Button type={bgColor === color.value ? 'primary' : 'default'} aria-pressed={bgColor === color.value} aria-label={color.label}
                    style={{ background: color.value || undefined, outline: bgColor === color.value ? '2px solid var(--ui-primary)' : undefined, outlineOffset: 2, width: 36, padding: 0 }}
                    key={color.value}
                    htmlType="button"
                    onClick={() => setBgColor(color.value)}

                    title={color.label}
                  >
                    {color.value === '' && (
                      <span className="absolute inset-0 flex items-center justify-center text-[var(--ui-text-secondary)] text-xs font-medium">
                        默认
                      </span>
                    )}
                  </Button>
                ))}
              </div>
              {/* 自定义颜色输入 */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor || '#3b82f6'}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-10 h-10 rounded-xl bg-transparent border border-white/20 cursor-pointer"
                  title="自定义颜色"
                />
                <Input
                  type="text"
                  placeholder="或输入颜色代码 (如: #ff0000)"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1"
                aria-label="或输入颜色代码 (如: #ff0000)" />
              </div>
            </div>

            <Button type="primary"
              htmlType="submit"
              loading={isLoading} disabled={isLoading}
              className="w-full mt-2"
            >
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </form>

    </Modal>
  );
};
