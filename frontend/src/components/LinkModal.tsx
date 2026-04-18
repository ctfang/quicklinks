import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, Type, Image, LayoutGrid, Folder } from 'lucide-react';
import { NavLink, NavGroup } from '../services/api';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (link: Partial<NavLink>) => Promise<void>;
  initialData?: NavLink | null;
  groups?: NavGroup[];
}

export const LinkModal = ({ isOpen, onClose, onSave, initialData, groups = [] }: LinkModalProps) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');
  const [displaySize, setDisplaySize] = useState<NavLink['displaySize']>('icon');
  const [groupId, setGroupId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setUrl(initialData.url);
      setIcon(initialData.icon || '');
      setDisplaySize(initialData.displaySize || 'medium');
      setGroupId(initialData.groupId || '');
    } else {
      setTitle('');
      setUrl('');
      setIcon('');
      setDisplaySize('icon');
      setGroupId('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    setIsLoading(true);
    try {
      const payload: Partial<NavLink> = {
        url: u,
        displaySize,
        groupId: groupId || undefined,
      };
      const t = title.trim();
      if (t) payload.title = t;
      const ic = icon.trim();
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

            <div className="relative">
              <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input 
                type="text" 
                placeholder="图标：Lucide 名称或图片 URL（可选，留空则使用站点图标）" 
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
              />
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
