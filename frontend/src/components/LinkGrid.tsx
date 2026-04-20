import React, { useState, useMemo } from 'react';
import { NavLink } from '../services/api';
import * as Icons from 'lucide-react';
import { Edit2, Trash2, Plus, ExternalLink, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { DndContext, DragEndEvent, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TAIL_PLACEHOLDER_ID = '__tail_placeholder__';

// 生成行间占位符ID
const getRowSeparatorId = (rowNum: number) => `__row_separator_${rowNum}__`;

// 尾部占位符组件 - 用于拖拽时创建新行
const TailPlaceholder = ({ id, isDragActive }: { id: string; isDragActive: boolean }) => {
  const { setNodeRef, isOver } = useSortable({
    id,
    disabled: true  // 禁用拖拽，只作为 drop target
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "col-span-12 min-h-[60px] rounded-2xl border-2 border-dashed transition-all duration-200",
        !isDragActive && "opacity-0 pointer-events-none h-0 min-h-0 border-0 overflow-hidden",
        isDragActive && (isOver
          ? "border-blue-400/60 bg-blue-400/10"
          : "border-white/15 bg-white/5")
      )}
    />
  );
};

// 行间占位符组件 - 用于拖拽时跨行移动
const RowSeparatorPlaceholder = ({ id, isDragActive }: { id: string; isDragActive: boolean }) => {
  const { setNodeRef, isOver } = useSortable({
    id,
    disabled: true  // 禁用拖拽，只作为 drop target
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "col-span-12 h-4 my-1 rounded-lg border-2 border-dashed transition-all duration-200",
        !isDragActive && "opacity-0 pointer-events-none h-0 my-0 border-0 overflow-hidden",
        isDragActive && (isOver
          ? "border-blue-400/60 bg-blue-400/20"
          : "border-white/10 bg-white/5")
      )}
    />
  );
};

type DisplaySize = 'icon' | 'small' | 'medium' | 'large' | 'list';

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

interface SortableLinkItemProps {
  link: NavLink;
  showActions: boolean;
  onEdit?: (link: NavLink) => void;
  onDelete?: (id: string) => void;
  isDragEnabled: boolean;
}

const SortableLinkItem = ({ link, showActions, onEdit, onDelete, isDragEnabled }: SortableLinkItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: link.id,
    disabled: !isDragEnabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const size = link.displaySize || 'medium';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group transition-all duration-300",
        size === 'icon' && "w-14 h-14 sm:w-16 sm:h-16 aspect-square",
        size === 'small' && "col-span-6 sm:col-span-4 md:col-span-3 lg:col-span-2",
        size === 'medium' && "col-span-6 sm:col-span-4 md:col-span-3 lg:col-span-2",
        size === 'large' && "col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3",
        size === 'list' && "col-span-12 sm:col-span-12 md:col-span-6 lg:col-span-4",
        isDragging && "shadow-2xl",
      )}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        title={size === 'icon' ? link.title : undefined}
        draggable={false}
        onClick={showActions ? (e) => e.preventDefault() : undefined}
        className={cn(
          "flex items-center w-full h-full rounded-2xl transition-all duration-300 overflow-hidden p-3 shadow-sm",
          link.bgColor
            ? ""
            : "bg-black/20 hover:bg-black/30 border border-white/10 hover:border-white/25 backdrop-blur-sm",
          size === 'icon' && "items-center justify-center",
          size === 'small' && "flex-row gap-3 items-center",
          size === 'medium' && "flex-row gap-3 items-center justify-center",
          size === 'large' && "flex-row gap-3 items-center",
          size === 'list' && "flex-row gap-3 items-center justify-between"
        )}
        style={link.bgColor ? {
          backgroundColor: link.bgColor,
          border: '1px solid rgba(255,255,255,0.15)'
        } : undefined}
      >
        <div className={cn(
          "flex items-center justify-center text-white/90 group-hover:text-white transition-colors shrink-0 rounded-lg",
          "bg-transparent",
          size === 'icon' && "w-7 h-7",
          size === 'small' && "w-8 h-8",
          size === 'medium' && "w-8 h-8",
          size === 'large' && "w-12 h-12 rounded-xl",
          size === 'list' && "w-10 h-10"
        )}>
          <NavIcon
            name={link.icon}
            url={link.url}
            pixelSize={size === 'icon' || size === 'small' || size === 'medium' ? 18 : 24}
            strokeWidth={1.5}
          />
        </div>

        {size !== 'icon' && (
          <div className={cn(
            "flex flex-col overflow-hidden",
            size === 'list' && "flex-1"
          )}>
            <span className={cn(
              "font-medium text-white truncate w-full transition-colors drop-shadow-sm",
              size === 'small' && "text-xs",
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
        )}
      </a>

      {showActions && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          {/* 拖拽手柄 - 使用 dnd-kit 的 listeners */}
          {isDragEnabled && (
            <button
              className="p-1.5 text-white/50 hover:text-white/80 cursor-grab active:cursor-grabbing select-none bg-slate-900/90 backdrop-blur-md rounded-lg border border-white/20 shadow-xl"
              {...attributes}
              {...listeners}
              title="拖拽排序"
            >
              <GripVertical size={14} />
            </button>
          )}
          {/* 编辑按钮 */}
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit?.(link); }}
            className="p-1.5 text-white/70 hover:text-blue-400 hover:bg-white/10 rounded-md transition-colors bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-xl"
          >
            <Edit2 size={12} />
          </button>
          {/* 删除按钮 */}
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete?.(link.id); }}
            className="p-1.5 text-white/70 hover:text-red-400 hover:bg-white/10 rounded-md transition-colors bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-xl"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

interface LinkGridProps {
  title?: string;
  links: NavLink[];
  onEdit?: (link: NavLink) => void;
  onDelete?: (id: string) => void;
  onAdd?: () => void;
  showActions?: boolean;
  onReorder?: (groupId: string | undefined, links: NavLink[]) => void;
  groupId?: string;
  groupActions?: React.ReactNode;
}

export const LinkGrid = ({ title, links, onEdit, onDelete, onAdd, showActions, onReorder, groupId, groupActions }: LinkGridProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px 拖拽激活距离，避免误触
      },
    })
  );

  // 按 rowNum 分组
  const rows = useMemo(() => {
    const rowMap = new Map<number, NavLink[]>();
    links.forEach(link => {
      const rowNum = link.rowNum ?? 0;
      if (!rowMap.has(rowNum)) rowMap.set(rowNum, []);
      rowMap.get(rowNum)!.push(link);
    });
    // 按行号排序
    return Array.from(rowMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([rowNum, rowLinks]) => ({
        rowNum,
        links: rowLinks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      }));
  }, [links]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id || !onReorder) {
      setActiveId(null);
      return;
    }

    const activeLink = links.find(l => l.id === active.id);
    if (!activeLink) { setActiveId(null); return; }

    // 处理行间占位符 - 将元素移动到下方那行的末尾
    const overId = over.id as string;
    if (overId.startsWith('__row_separator_')) {
      const match = overId.match(/__row_separator_(\d+)__/);
      if (match) {
        const targetRowNum = parseInt(match[1], 10);
        const sourceRowNum = activeLink.rowNum ?? 0;
        
        if (sourceRowNum !== targetRowNum) {
          // 获取目标行当前的所有链接（排除正在拖拽的元素）
          const targetRowLinks = links.filter(l => (l.rowNum ?? 0) === targetRowNum && l.id !== active.id);
          const newOrder = targetRowLinks.length; // 放到行尾
          
          // 获取源行当前的所有链接（排除正在拖拽的元素）
          const sourceRowLinks = links.filter(l => (l.rowNum ?? 0) === sourceRowNum && l.id !== active.id);
          
          const updatedLinks = links.map(l => {
            if (l.id === active.id) {
              return { ...l, rowNum: targetRowNum, order: newOrder };
            }
            // 更新目标行其他元素的 order
            if ((l.rowNum ?? 0) === targetRowNum && l.id !== active.id) {
              const idx = targetRowLinks.findIndex(r => r.id === l.id);
              return { ...l, order: idx };
            }
            // 更新源行其他元素的 order
            if ((l.rowNum ?? 0) === sourceRowNum && l.id !== active.id) {
              const idx = sourceRowLinks.findIndex(r => r.id === l.id);
              return { ...l, order: idx };
            }
            return l;
          });
          onReorder(groupId, updatedLinks);
        }
      }
      setActiveId(null);
      return;
    }

    if (over.id === TAIL_PLACEHOLDER_ID) {
      // 移动到新行：rowNum = 最大行号 + 1，order = 0
      const maxRow = Math.max(...links.map(l => l.rowNum ?? 0));
      const updatedLinks = links.map(l => 
        l.id === active.id 
          ? { ...l, rowNum: maxRow + 1, order: 0 } 
          : l
      );
      onReorder(groupId, updatedLinks);
    } else {
      // 移动到现有元素位置
      const overLink = links.find(l => l.id === over.id);
      if (!overLink) { setActiveId(null); return; }
      
      const targetRowNum = overLink.rowNum ?? 0;
      const sourceRowNum = activeLink.rowNum ?? 0;
      
      if (sourceRowNum === targetRowNum) {
        // 行内排序：只改 order
        const rowLinks = links.filter(l => (l.rowNum ?? 0) === targetRowNum);
        const oldIndex = rowLinks.findIndex(l => l.id === active.id);
        const newIndex = rowLinks.findIndex(l => l.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(rowLinks, oldIndex, newIndex);
          const updatedLinks = links.map(l => {
            if ((l.rowNum ?? 0) !== targetRowNum) return l;
            const idx = reordered.findIndex(r => r.id === l.id);
            return idx !== -1 ? { ...l, order: idx } : l;
          });
          onReorder(groupId, updatedLinks);
        }
      } else {
        // 跨行拖拽：移到目标行，插入 over 位置
        const targetRowLinks = links.filter(l => (l.rowNum ?? 0) === targetRowNum && l.id !== active.id);
        const overIndex = targetRowLinks.findIndex(l => l.id === over.id);
        targetRowLinks.splice(overIndex, 0, activeLink);
        
        // 更新源行的 order
        const sourceRowLinks = links.filter(l => (l.rowNum ?? 0) === sourceRowNum && l.id !== active.id);
        
        const updatedLinks = links.map(l => {
          if (l.id === active.id) {
            return { ...l, rowNum: targetRowNum, order: overIndex };
          }
          if ((l.rowNum ?? 0) === targetRowNum && l.id !== active.id) {
            const idx = targetRowLinks.findIndex(r => r.id === l.id);
            return { ...l, order: idx };
          }
          if ((l.rowNum ?? 0) === sourceRowNum && l.id !== active.id) {
            const idx = sourceRowLinks.findIndex(r => r.id === l.id);
            return { ...l, order: idx };
          }
          return l;
        });
        onReorder(groupId, updatedLinks);
      }
    }
    
    setActiveId(null);
  };

  const activeLink = activeId ? links.find(l => l.id === activeId) : null;
  const isDragEnabled = !!onReorder && showActions;

  return (
    <div className="w-full">
      {title && (
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
            {title}
            {groupActions}
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={[
              ...links.map(l => l.id), 
              TAIL_PLACEHOLDER_ID,
              ...rows.map(row => getRowSeparatorId(row.rowNum))
            ]} 
            strategy={rectSortingStrategy}
          >
            <div className="space-y-2">
              {rows.map((row, index) => (
                <React.Fragment key={row.rowNum}>
                  {/* 行间占位符 - 在当前行之前显示（除了第一行） */}
                  {index > 0 && (
                    <RowSeparatorPlaceholder 
                      id={getRowSeparatorId(row.rowNum)} 
                      isDragActive={activeId !== null} 
                    />
                  )}
                  <div className="grid grid-cols-12 gap-3 md:gap-4 overflow-visible">
                    {row.links.map(link => (
                      <SortableLinkItem
                        key={link.id}
                        link={link}
                        showActions={showActions || false}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        isDragEnabled={isDragEnabled}
                      />
                    ))}
                  </div>
                </React.Fragment>
              ))}
              {/* 尾部占位符 - 拖拽时显示，创建新行 */}
              <TailPlaceholder id={TAIL_PLACEHOLDER_ID} isDragActive={activeId !== null} />
            </div>
          </SortableContext>

          {/* DragOverlay - 拖拽时的浮层，提供更好的视觉反馈 */}
          <DragOverlay>
            {activeLink ? (
              <div className={cn(
                "rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl p-3",
                "pointer-events-none"
              )}>
                <span className="text-white text-sm">{activeLink.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};
