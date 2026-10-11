import React, { useState, useRef } from 'react';
import { NavLink } from '../services/api';
import * as Icons from 'lucide-react';
import { Edit2, Trash2, Plus, ExternalLink, ArrowUpRight, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { navigationCardSize, type CardLayout } from '../lib/navigationCard';

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

export function NavIcon({
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
  const [imgFailed, setImgFailed] = useState(false);
  const trimmed = (name || '').trim();
  const isUrl = /^https?:\/\//i.test(trimmed);

  // 如果有有效的图标URL且加载成功，显示图片
  if (isUrl && !imgFailed) {
    return (
      <img
        src={trimmed}
        alt=""
        className="max-w-[85%] max-h-[85%] object-contain"
        onError={() => setImgFailed(true)}
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
        fontSize: `${pixelSize}px`,
        lineHeight: 1,
      }}
    >
      {letter}
    </span>
  );
}

interface LinkGridProps {
  title?: string;
  links: NavLink[];
  onEdit?: (link: NavLink) => void;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
  showActions?: boolean;
  onReorder?: (groupId: string | undefined, links: NavLink[]) => void;
  groupId?: string;
  cardMode?: 'mixed' | 'uniform';
  layoutMode?: CardLayout;
}

function CardContent({ link, size }: { link: NavLink; size: string }) {
  let domain = link.url.replace(/^https?:\/\//, '').split('/')[0];
  try { domain = new URL(link.url).hostname.replace(/^www\./, ''); } catch { /* 保留原地址 */ }
  return <>
    <div className="card-body">
      <div className="navigation-icon"><NavIcon name={link.icon} url={link.url} pixelSize={size === 'large' ? 44 : size === 'medium' ? 32 : 26} strokeWidth={1.6} /></div>
      {size !== 'icon' && <div className="card-copy"><span className="card-title">{link.title}</span><span className="card-domain">{domain}</span></div>}
    </div>
    {size !== 'icon' && <ArrowUpRight className="card-compact-arrow" size={16} />}
  </>;
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
        <div className="navigation-grid grid grid-cols-12 gap-3 md:gap-4 grid-flow-dense">
          {links.map((link, index) => {
            const configuredSize = navigationCardSize(link.displaySize, index, showActions ? 'configured' : layoutMode);
            const size = showActions && configuredSize === 'icon' ? 'small' : configuredSize;
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            
            return (
              <div 
                key={link.id} 
                className={cn(
                  "relative group min-w-0 transition-all duration-300",
                  size === 'icon' && "col-span-3 sm:col-span-2 lg:col-span-1 row-span-1",
                  size === 'small' && "col-span-6 sm:col-span-4 lg:col-span-3 row-span-1",
                  size === 'medium' && "col-span-6 sm:col-span-4 lg:col-span-3 row-span-2",
                  size === 'large' && "col-span-12 sm:col-span-8 lg:col-span-6 row-span-2",
                  size === 'list' && "col-span-12 sm:col-span-12 lg:col-span-6 row-span-1",
                  isDragging && "opacity-50",
                  isDragOver && "scale-105"
                )}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.title}
                  aria-label={link.title}
                  data-card-size={size}
                  data-nav-title={link.title}
                  data-nav-icon={link.icon}
                  draggable={false}
                  className={cn(
                    "navigation-card flex items-center w-full h-full rounded-2xl transition-all duration-300 overflow-hidden p-3 shadow-sm",
                    !showActions && `card-public card-tone-${index % 3}`,
                    !showActions && cardMode === 'uniform' && 'card-mode-uniform',
                    link.bgColor && 'card-custom',
                    !showActions && !link.bgColor && cardMode === 'mixed' && size === 'large' && 'card-featured',
                    // 晴天背景下增强对比度：使用更深的背景色和更强的边框
                    link.bgColor 
                      ? "" // 自定义背景色时，由style处理
                      : "bg-black/20 hover:bg-black/30 border border-white/10 hover:border-white/25 backdrop-blur-sm",
                    size === 'icon' && "items-center justify-center",
                    size === 'small' && "flex-row gap-3 items-center",
                    size === 'medium' && "flex-col gap-3 items-center justify-center text-center",
                    size === 'large' && "flex-row gap-4 items-center px-5",
                    size === 'list' && "flex-row gap-3 items-center justify-between"
                  )}
                  style={link.bgColor ? {
                    backgroundColor: link.bgColor,
                    border: '1px solid rgba(255,255,255,0.15)'
                  } : undefined}
                >
                  {!showActions ? <CardContent link={link} size={size} /> : <><div className={cn(
                    "navigation-icon flex items-center justify-center text-white/90 group-hover:text-white transition-colors shrink-0 rounded-lg",
                    // 图标容器始终使用透明背景，避免与按钮背景产生视觉间隙
                    "bg-transparent",
                    size === 'icon' && "w-7 h-7",
                    size === 'small' && "w-10 h-10",
                    size === 'medium' && "w-12 h-12",
                    size === 'large' && "w-12 h-12 rounded-xl",
                    size === 'list' && "w-10 h-10"
                  )}>
                    <NavIcon
                      name={link.icon}
                      url={link.url}
                      pixelSize={size === 'icon' || size === 'small' ? 18 : 28}
                      strokeWidth={1.5}
                    />
                  </div>
                  
                  {size !== 'icon' && (
                    <div className={cn(
                      "min-w-0 flex flex-col overflow-hidden",
                      size === 'list' && "flex-1"
                    )}>
                      <span className={cn(
                        "font-medium text-white truncate w-full transition-colors drop-shadow-sm",
                        (size === 'small' || size === 'medium') && "text-sm",
                        size === 'large' && "text-base",
                        size === 'list' && "text-sm"
                      )}>
                        {link.title}
                      </span>
                      {(size === 'large' || size === 'list') && (
                        <span className="text-xs text-white/70 group-hover:text-white/90 truncate w-full mt-0.5 transition-colors drop-shadow-sm">
                          {link.url.replace(/^https?:\/\//, '')}
                        </span>
                      )}
                    </div>
                  )}

                  {size === 'list' && (
                    <div className="text-white/20 group-hover:text-white/50 transition-colors shrink-0 ml-2">
                      <ExternalLink size={16} />
                    </div>
                  )}</>}
                </a>

                {showActions && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit?.(link); }}
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
