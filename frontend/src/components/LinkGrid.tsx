import React, { memo, useState, useRef } from 'react';
import { NavLink } from '../services/api';
import * as Icons from 'lucide-react';
import { Edit2, Trash2, Plus, ArrowUpRight, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { navigationCardSize, type CardLayout } from '../lib/navigationCard';

// 最近导航复用主列表已失败的图标结果，避免每次新建记录再次加载再切回占位图。
const failedIconUrls = new Set<string>();

function getLetterFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // 移除 www. 前缀
    const domain = hostname.replace(/^www\./, '');
    // 返回首字母大写
    return domain.charAt(0).toUpperCase();
  } catch {
    return '?';
  }
}

export const NavIcon = memo(function NavIcon({
  name,
  url,
  pixelSize,
  strokeWidth,
  label,
}: {
  name: string;
  url: string;
  pixelSize: number;
  strokeWidth: number;
  label?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const trimmed = (name || '').trim();
  const isUrl = /^https?:\/\//i.test(trimmed);

  // 如果有有效的图标URL且加载成功，显示图片
  if (isUrl && failedSrc !== trimmed && !failedIconUrls.has(trimmed)) {
    return (
      <img
        src={trimmed}
        alt=""
        className="max-w-[85%] max-h-[85%] object-contain"
        onError={() => { failedIconUrls.add(trimmed); setFailedSrc(trimmed); }}
        referrerPolicy="no-referrer"
      />
    );
  }

  // 如果图标加载失败或没有图标，尝试使用Lucide图标
  const IconsRecord = Icons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>;
  const IconComponent = IconsRecord[trimmed];
  if (IconComponent) {
    return <IconComponent size={pixelSize} strokeWidth={strokeWidth} />;
  }

  // 如果没有匹配的Lucide图标，显示URL首字母
  const letter = label?.trim().charAt(0).toUpperCase() || getLetterFromUrl(url);
  return (
    <span
      className="font-bold text-white/90 select-none"
      style={{
        fontSize: `var(--nav-letter-size, ${pixelSize}px)`,
        lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
});

interface LinkGridProps {
  title?: string;
  links: NavLink[];
  onEdit?: (link: NavLink, size: NavLink['displaySize']) => void;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
  showActions?: boolean;
  onReorder?: (groupId: string | undefined, links: NavLink[]) => void;
  groupId?: string;
  cardMode?: 'mixed' | 'uniform';
  layoutMode?: CardLayout;
}

export function NavigationLinkCard({ link, size, className }: { link: NavLink; size: string; className?: string }) {
  let domain = link.url;
  try { domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch { /* 保留地址 */ }
  // 中文等全宽字符按一字计算，拉丁字符和空格按较窄宽度估算。
  const titleUnits = Math.max(1, Array.from(link.title.trim()).reduce((total, char) => total + (/\s/.test(char) ? 0.3 : /[\x00-\x7f]/.test(char) ? 0.6 : 1), 0));
  return <a className={cn(`site-card size-${size}`, link.bgColor && 'has-custom-color', className)} style={{ background: link.bgColor || undefined, '--nav-title-units': titleUnits } as React.CSSProperties}
    href={link.url} target="_blank" rel="noopener noreferrer" title={`${link.title} · ${domain}`} aria-label={link.title} draggable={false}
    data-nav-title={link.title} data-nav-icon={link.icon} data-card-size={size}>
    <span className="site-icon"><NavIcon name={link.icon} url={link.url} label={link.title} pixelSize={size === 'medium' ? 40 : size === 'large' ? 34 : 26} strokeWidth={1.7} /></span>
    {size !== 'icon' && <span className="site-copy"><span className="site-name">{link.title}</span><span className="site-domain">{domain}</span></span>}
    {size !== 'icon' && <ArrowUpRight className="site-arrow" size={15} />}
  </a>;
}

export const LinkGrid = ({ title, links, onEdit, onDelete, onAdd, showActions, onReorder, groupId, cardMode = 'mixed', layoutMode = 'configured' }: LinkGridProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!showActions || !onReorder) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // 使用默认拖拽图像，提供视觉反馈
    // 不设置自定义 dragImage，让浏览器使用默认的半透明克隆
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    if (!showActions || !onReorder) return;
    e.preventDefault();
    dragCounter.current++;
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!showActions || !onReorder) return;
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!showActions || !onReorder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!showActions || !onReorder) return;
    e.preventDefault();
    dragCounter.current = 0;
    setDragOverIndex(null);
    
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const newLinks = [...links];
      const [removed] = newLinks.splice(draggedIndex, 1);
      newLinks.splice(dropIndex, 0, removed);
      onReorder(groupId, newLinks);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  return (
    <div className="w-full">
      {title && (
        <div className="navigation-group-heading flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
            {title}
            {!showActions && <span className="navigation-group-count">{links.length.toString().padStart(2, '0')}</span>}
          </h3>
          {showActions && onAdd && (
            <button 
              onClick={onAdd}
              className="flex items-center gap-1 text-xs font-medium text-white/50 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors"
            >
              <Plus size={14} />
              添加导航
            </button>
          )}
        </div>
      )}
      
      {links.length === 0 ? (
        <div className="text-center py-8 text-white/40 bg-white/5 rounded-2xl border border-white/5 border-dashed">
          <p className="text-sm">暂无导航链接</p>
        </div>
      ) : (
        <div className={cn('site-grid navigation-grid',
          (layoutMode === 'icons' || links.every((link, index) => navigationCardSize(link.displaySize, index, layoutMode) === 'icon')) && 'icons-only',
          cardMode === 'uniform' && 'uniform-cards'
        )}>
          {links.map((link, index) => {
            const size = navigationCardSize(link.displaySize, index, layoutMode);
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            
            return (
              <div 
                key={link.id} 
                className={cn(
                  `navigation-card-slot site-card size-${size} relative group min-w-0`,
                  isDragging && "opacity-50",
                  isDragOver && "scale-105"
                )}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <NavigationLinkCard link={link} size={size} className="navigation-card" />

                {showActions && (
                  <div className="navigation-card-actions absolute flex items-center gap-1">
                    {/* 拖拽手柄 */}
                    {onReorder && (
                      <div 
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 text-white/50 hover:text-white/80 cursor-grab active:cursor-grabbing select-none bg-slate-900/90 backdrop-blur-md rounded-lg border border-white/20 shadow-xl"
                        title="拖拽排序"
                      >
                        <GripVertical size={14} />
                      </div>
                    )}
                    {/* 编辑按钮 */}
                    <button 
                      aria-label={`编辑 ${link.title}`}
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit?.(link, size); }}
                      className="p-1.5 text-white/70 hover:text-blue-400 hover:bg-white/10 rounded-md transition-colors bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-xl"
                    >
                      <Edit2 size={12} />
                    </button>
                    {/* 删除按钮 */}
                    <button 
                      aria-label={`删除 ${link.title}`}
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete?.(link.id); }}
                      className="p-1.5 text-white/70 hover:text-red-400 hover:bg-white/10 rounded-md transition-colors bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-xl"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
