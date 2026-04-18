import React, { useState } from 'react';
import { NavLink } from '../services/api';
import * as Icons from 'lucide-react';
import { Edit2, Trash2, Plus, ExternalLink, Link as LinkLucide } from 'lucide-react';
import { cn } from '../lib/utils';

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

function NavIcon({
  name,
  url,
  pixelSize,
  strokeWidth,
}: {
  name: string;
  url: string;
  pixelSize: number;
  strokeWidth: number;
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
  const letter = getLetterFromUrl(url);
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
}

export const LinkGrid = ({ title, links, onEdit, onDelete, onAdd, showActions }: LinkGridProps) => {
  return (
    <div className="w-full">
      {title && (
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
            {title}
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
        <div className="grid grid-cols-12 gap-3 md:gap-4 grid-flow-dense">
          {links.map(link => {
            const size = link.displaySize || 'medium';
            
            return (
              <div 
                key={link.id} 
                className={cn(
                  "relative group transition-all duration-300",
                  size === 'icon' && "col-span-3 sm:col-span-2 md:col-span-1",
                  size === 'small' && "col-span-6 sm:col-span-4 md:col-span-3 lg:col-span-2",
                  size === 'medium' && "col-span-6 sm:col-span-4 md:col-span-3 lg:col-span-2",
                  size === 'large' && "col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3",
                  size === 'list' && "col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-4"
                )}
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={size === 'icon' ? link.title : undefined}
                  className={cn(
                    "flex items-center w-full h-full rounded-2xl bg-white/5 hover:bg-white/15 border border-white/5 hover:border-white/20 transition-all duration-300 overflow-hidden",
                    size === 'icon' && "flex-col p-2 justify-center items-center w-12 h-12",
                    size === 'small' && "flex-row px-3 py-2.5 gap-3 items-center",
                    size === 'medium' && "flex-row px-3 py-2.5 gap-3 items-center justify-center",
                    size === 'large' && "flex-row p-4 gap-4 items-center",
                    size === 'list' && "flex-row px-4 py-3 gap-4 items-center justify-between"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center text-white/80 group-hover:text-white transition-colors shrink-0",
                    size === 'icon' && "w-8 h-8",
                    size === 'small' && "w-8 h-8 rounded-lg bg-white/5",
                    size === 'medium' && "w-8 h-8 rounded-lg bg-white/5",
                    size === 'large' && "w-12 h-12 rounded-xl bg-white/10",
                    size === 'list' && "w-10 h-10 rounded-xl bg-white/5"
                  )}>
                    <NavIcon
                      name={link.icon}
                      url={link.url}
                      pixelSize={size === 'icon' || size === 'small' || size === 'medium' ? 18 : 24}
                      strokeWidth={1.5}
                    />
                  </div>
                  
                  {size !== 'icon' && size !== 'medium' && (
                    <div className={cn(
                      "flex flex-col overflow-hidden",
                      size === 'list' && "flex-1"
                    )}>
                      <span className={cn(
                        "font-medium text-white/90 group-hover:text-white truncate w-full transition-colors",
                        size === 'small' && "text-xs",
                        size === 'large' && "text-base",
                        size === 'list' && "text-sm"
                      )}>
                        {link.title}
                      </span>
                      {(size === 'large' || size === 'list') && (
                        <span className="text-xs text-white/40 group-hover:text-white/60 truncate w-full mt-0.5 transition-colors">
                          {link.url.replace(/^https?:\/\//, '')}
                        </span>
                      )}
                    </div>
                  )}

                  {size === 'list' && (
                    <div className="text-white/20 group-hover:text-white/50 transition-colors shrink-0 ml-2">
                      <ExternalLink size={16} />
                    </div>
                  )}
                </a>

                {showActions && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-white/20 shadow-xl z-10">
                    <button 
                      onClick={(e) => { e.preventDefault(); onEdit?.(link); }}
                      className="p-1.5 text-white/70 hover:text-blue-400 hover:bg-white/10 rounded-md transition-colors"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); onDelete?.(link.id); }}
                      className="p-1.5 text-white/70 hover:text-red-400 hover:bg-white/10 rounded-md transition-colors"
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
