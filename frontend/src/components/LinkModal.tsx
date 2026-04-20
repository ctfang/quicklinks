import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Type, Image, LayoutGrid, Folder, Palette } from 'lucide-react';
import * as Icons from 'lucide-react';
import { NavLink, NavGroup } from '../services/api';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: Partial<NavLink>) => Promise<void>;
  initialData?: Partial<NavLink> | null;
  groups?: NavGroup[];
}

export const LinkModal = ({ isOpen, onClose, onSave, initialData, groups = [] }: LinkModalProps) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');
  const [displaySize, setDisplaySize] = useState<NavLink['displaySize']>('small');
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
    { value: '', label: '默认', class: 'bg-black/20' },
    { value: '#3b82f6', label: '蓝色', class: 'bg-blue-500' },
    { value: '#10b981', label: '绿色', class: 'bg-green-500' },
    { value: '#f59e0b', label: '橙色', class: 'bg-amber-500' },
    { value: '#ef4444', label: '红色', class: 'bg-red-500' },
    { value: '#8b5cf6', label: '紫色', class: 'bg-violet-500' },
    { value: '#ec4899', label: '粉色', class: 'bg-pink-500' },
    { value: '#06b6d4', label: '青色', class: 'bg-cyan-500' },
    { value: '#6366f1', label: '靛蓝', class: 'bg-indigo-500' },
    { value: '#14b8a6', label: ' teal', class: 'bg-teal-500' },
    { value: '#f97316', label: '橙红', class: 'bg-orange-500' },
    { value: '#84cc16', label: '青柠', class: 'bg-lime-500' },
  ];

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setUrl(initialData.url || '');
      setIcon(initialData.icon || '');
      setDisplaySize(initialData.displaySize || 'small');
      setGroupId(initialData.groupId || '');
      setBgColor(initialData.bgColor || '');
      // 判断当前图标是预设图标还是URL
      const trimmedIcon = (initialData.icon || '').trim();
      setIconMode(/^https?:\/\//i.test(trimmedIcon) ? 'url' : 'preset');
    } else {
      setTitle('');
      setUrl('');
      setIcon('');
      setDisplaySize('small');
      setGroupId('');
      setBgColor('');
      setIconMode('preset');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = (url || '').trim();
    if (!u) return;
    setIsLoading(true);
    try {
      const payload: Partial<NavLink> = {
        url: u,
        displaySize,
        groupId: groupId || undefined,
        // 显式发送 null 来清除背景色，undefined 会被 JSON.stringify 忽略
        bgColor: bgColor || null,
      };
      const t = (title || '').trim();
      if (t) payload.title = t;
      const ic = (icon || '').trim();
      if (ic) payload.icon = ic;
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {initialData ? '编辑导航' : '添加导航'}
          </h2>
          <p className="text-white/60 text-sm mb-8">
            {initialData ? '修改链接信息' : '只需填写地址；标题与图标可由服务器自动抓取'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input 
                type="text" 
                placeholder="网站地址（必填，可省略 https://）" 
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="relative">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input 
                type="text" 
                placeholder="网站名称（可选，留空则自动抓取）" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* 图标选择 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Image size={16} />
                  <span>图标</span>
                </div>
                <div className="flex bg-white/5 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setIconMode('preset')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      iconMode === 'preset' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    预设图标
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconMode('url')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      iconMode === 'url' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    图片URL
                  </button>
                </div>
              </div>

              {iconMode === 'preset' ? (
                <div className="grid grid-cols-9 gap-1 max-h-32 overflow-y-auto p-1">
                  <button
                    type="button"
                    onClick={() => setIcon('')}
                    className={`aspect-square flex items-center justify-center rounded-lg transition-all ${
                      icon === '' 
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                    title="自动获取"
                  >
                    <span className="text-xs">自动</span>
                  </button>
                  {iconOptions.map((option) => {
                    const IconsRecord = Icons as unknown as Record<string, React.ComponentType<{ size?: number }>>;
                    const IconComponent = IconsRecord[option.name];
                    if (!IconComponent) return null;
                    return (
                      <button
                        key={option.name}
                        type="button"
                        onClick={() => setIcon(option.name)}
                        className={`aspect-square flex items-center justify-center rounded-lg transition-all ${
                          icon === option.name 
                            ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                        }`}
                        title={option.label}
                      >
                        <IconComponent size={18} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="relative">
                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input 
                    type="text" 
                    placeholder="输入图标图片 URL（如: https://example.com/icon.png）" 
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}
            </div>

            {groups.length > 0 && (
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                >
                  <option value="" className="bg-slate-800">未分组</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id} className="bg-slate-800">{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative">
              <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <select
                value={displaySize}
                onChange={(e) => setDisplaySize(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              >
                <option value="icon" className="bg-slate-800">极简图标 (最小)</option>
                <option value="small" className="bg-slate-800">小尺寸 (紧凑列表)</option>
                <option value="medium" className="bg-slate-800">中尺寸 (标准卡片)</option>
                <option value="large" className="bg-slate-800">大尺寸 (宽幅卡片)</option>
                <option value="list" className="bg-slate-800">列表 (横向拉伸)</option>
              </select>
            </div>

            {/* 背景颜色选择 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Palette size={16} />
                <span>背景颜色</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setBgColor(color.value)}
                    className={`
                      relative w-10 h-10 rounded-xl transition-all duration-200
                      ${color.class}
                      ${bgColor === color.value 
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' 
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }
                    `}
                    title={color.label}
                  >
                    {color.value === '' && (
                      <span className="absolute inset-0 flex items-center justify-center text-white/60 text-xs font-medium">
                        默认
                      </span>
                    )}
                  </button>
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
                <input
                  type="text"
                  placeholder="或输入颜色代码 (如: #ff0000)"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
